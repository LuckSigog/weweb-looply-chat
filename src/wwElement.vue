<template>
    <!-- Adicionado :data-theme para controlar o tema via CSS -->
    <div class="looply-chat-app" :data-theme="theme">
        <div class="chat-card">
            <div class="header">
                <div class="brand-logo">
                    <img :src="botLogoUrl" alt="Bot Logo" class="avatar-img">
                </div>
                <div class="brand-name">{{ brandName }}</div>
                <span class="status">{{ statusText }}</span>
            </div>

            <div ref="messagesContainer" class="messages">
                <div v-for="(message, index) in messages" :key="index" class="row" :class="message.type">
                    <div v-if="message.type === 'bot'" class="avatar">
                        <img :src="botLogoUrl" alt="Bot" class="avatar-img">
                    </div>

                    <!-- Balão de Mensagem -->
                    <div v-if="shouldShowSkeleton(message, index) || (message.text && message.text.length > 0)" 
                         class="bubble" 
                         :class="[message.type, { 'loading-state': shouldShowSkeleton(message, index) }]">
                        
                        <!-- CONTEÚDO: Skeleton Loader (Carregando) -->
                        <template v-if="shouldShowSkeleton(message, index)">
                            <div class="skeleton-loader">
                                <!-- Texto de Status com Animação Letra por Letra -->
                                <div class="loading-text-wrapper">
                                    <TransitionGroup name="staggered-fade" tag="span" class="loading-text-container">
                                        <span 
                                            v-for="(char, i) in getSplitText(currentLoadingText)" 
                                            :key="`${currentPhraseIndex}-${i}`" 
                                            class="char"
                                            :style="{ transitionDelay: `${i * 30}ms` }"
                                        >{{ char }}</span>
                                    </TransitionGroup>
                                </div>

                                <!-- Linhas do Skeleton (Ocupando largura total do balão 80%) -->
                                <div class="sk-line w-100"></div>
                                <div class="sk-line w-95"></div>
                                <div class="sk-line w-85"></div>
                            </div>
                        </template>

                        <!-- CONTEÚDO: Texto Final (Markdown) -->
                        <template v-else>
                            <div class="markdown-content" v-html="renderMarkdown(message.text)"></div>
                            <span class="meta">
                                {{ message.type === 'bot' ? brandName : 'Você' }} • {{ message.time }}
                            </span>
                        </template>
                    </div>

                    <div v-if="message.type === 'user'" class="avatar user-icon">👤</div>
                </div>
            </div>

            <div class="composer">
                <div class="field">
                    <label class="icon-btn" @click="triggerFileInput">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path fill="currentColor" fill-rule="evenodd" d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12m10 5.75a.75.75 0 0 0 .75-.75v-5.19l1.72 1.72a.75.75 0 1 0 1.06-1.06l-3-3a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l1.72-1.72V17c0 .414.336.75.75.75m-4-10a.75.75 0 0 1 0-1.5h8a.75.75 0 0 1 0 1.5z" clip-rule="evenodd" />
                        </svg>
                    </label>
                    <textarea 
                        ref="textareaInput" 
                        v-model="inputText" 
                        placeholder="Escreva sua mensagem..."
                        @keydown="handleKeydown" 
                        @input="updateTextareaHeight"
                    ></textarea>
                    <input ref="fileInputElement" type="file" multiple style="display: none" @change="handleFileSelect" />
                </div>
                <button class="send-btn" :disabled="isSending" @click="sendMessage">➤</button>
            </div>

            <div class="hint">
                Enter envia. Use <strong>Shift+Enter</strong> para quebrar linha.
            </div>
        </div>
    </div>
</template>

<script>
import { ref, computed, nextTick, onMounted } from 'vue';
import { marked } from 'marked';

export default {
    name: 'LooplyChat',
    props: {
        content: { type: Object, required: true },
        uid: { type: String, required: true },
        wwEditorState: { type: Object, required: true }
    },
    emits: ['trigger-event'],
    setup(props, { emit } ) {
        const messagesContainer = ref(null);
        const textareaInput = ref(null);
        const fileInputElement = ref(null);
        const messages = ref([]);
        const inputText = ref('');
        const isSending = ref(false);
        const streamingMessageRef = ref(null);
        const streamBuffer = ref('');

        // Lógica de frases de carregamento
        const loadingPhrases = [
            'Pensando...',
            'Analisando o contexto...',
            'Buscando informações...',
            'Gerando a melhor resposta...',
            'Quase lá...'
        ];
        const currentLoadingText = ref(loadingPhrases[0]);
        const currentPhraseIndex = ref(0);
        let loadingInterval = null;

        const startLoadingTextCycle = () => {
            let index = 0;
            currentPhraseIndex.value = 0;
            currentLoadingText.value = loadingPhrases[0];
            
            if (loadingInterval) clearInterval(loadingInterval);
            loadingInterval = setInterval(() => {
                index = (index + 1) % loadingPhrases.length;
                currentPhraseIndex.value = index;
                currentLoadingText.value = loadingPhrases[index];
            }, 3000);
        };

        const stopLoadingTextCycle = () => {
            if (loadingInterval) clearInterval(loadingInterval);
            loadingInterval = null;
        };
        
        const getSplitText = (text) => {
            return text.split('').map(char => char === ' ' ? '\u00A0' : char);
        };

        const brandName = computed(() => props.content?.brandName || 'LOOPLY');
        const brandColor = computed(() => props.content?.brandColor || '#ef4444');
        // Nova computed property para o tema
        const theme = computed(() => props.content?.theme || 'light');
        
        const statusText = computed(() => isSending.value ? 'Respondendo...' : 'Online');
        const botLogoUrl = ref("https://cdn.weweb.io/designs/55281739-2ed5-46ce-9832-6a234daa52c6/sections/Frame_2147223369.png?_wwcv=1770645958747");

        const { setValue: setMessageHistory } = wwLib.wwVariable.useComponentVariable({ 
            uid: props.uid, 
            name: 'messageHistory', 
            type: 'array', 
            defaultValue: [] 
        });

        marked.setOptions({ breaks: true, gfm: true });
        const renderMarkdown = (t) => t ? marked.parse(t) : '';
        
        const scrollToBottom = () => {
            nextTick(() => {
                if (messagesContainer.value) {
                    messagesContainer.value.scrollTo({
                        top: messagesContainer.value.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            });
        };

        const addMessage = (text, type = 'bot', isTyping = false) => {
            const msg = { 
                text: text || '', 
                type, 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                isTyping 
            };
            messages.value.push(msg);
            scrollToBottom();
            return messages.value[messages.value.length - 1];
        };

        const shouldShowSkeleton = (message, index) => {
            const isLastBotMessage = message.type === 'bot' && isSending.value && index === messages.value.length - 1;
            const hasNoText = !message.text || message.text.trim().length === 0;
            return message.isTyping || (isLastBotMessage && hasNoText);
        };

        const updateTextareaHeight = () => {
            if (textareaInput.value) {
                textareaInput.value.style.height = 'auto';
                textareaInput.value.style.height = `${Math.min(textareaInput.value.scrollHeight, 160)}px`;
            }
        };

        const handleJsonChunk = (jsonStr) => {
            if (!jsonStr.trim()) return;
            try {
                const data = JSON.parse(jsonStr);
                
                if (data.type === 'begin') {
                    if (streamingMessageRef.value) streamingMessageRef.value.isTyping = true;
                }

                if (data.type === 'item' && data.content !== undefined) {
                    if (streamingMessageRef.value) {
                        streamingMessageRef.value.text += data.content;
                        scrollToBottom();
                    }
                }

                if (data.type === 'end') {
                    if (streamingMessageRef.value) {
                        streamingMessageRef.value.isTyping = false;
                    }
                }
            } catch (e) {
                console.warn("Stream JSON error ignored:", e);
            }
        };

        const processStreamText = (text) => {
            streamBuffer.value += text;
            let lines = streamBuffer.value.split('\n');
            streamBuffer.value = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;
                let parts = line.split('}{');
                if (parts.length > 1) {
                    parts = parts.map((p, i) => {
                        if (i === 0) return p + '}';
                        if (i === parts.length - 1) return '{' + p;
                        return '{' + p + '}';
                    });
                    parts.forEach(p => handleJsonChunk(p));
                } else {
                    handleJsonChunk(line);
                }
            }

            try {
                handleJsonChunk(streamBuffer.value);
                streamBuffer.value = '';
            } catch (e) {}
        };

        const sendMessage = async () => {
            const text = inputText.value.trim();
            if (!text || isSending.value) return;

            const clientId = props.content?.clientId || '';

            inputText.value = '';
            if (textareaInput.value) textareaInput.value.style.height = 'auto';

            addMessage(text, 'user');
            isSending.value = true;
            
            startLoadingTextCycle();
            streamingMessageRef.value = addMessage('', 'bot', true); 
            
            streamBuffer.value = '';

            try {
                const res = await fetch(props.content.webhookUrl, {
                    method: 'POST',
                    body: JSON.stringify({ 
                        message: text, 
                        sessionId: props.uid,
                        clientId: clientId
                    }),
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!res.body) throw new Error("Sem corpo de resposta");

                const reader = res.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    processStreamText(decoder.decode(value, { stream: true }));
                }
            } catch (e) {
                console.error("Erro no chat:", e);
                if (streamingMessageRef.value) {
                    streamingMessageRef.value.isTyping = false;
                    streamingMessageRef.value.text = "Ocorreu um problema ao conectar com o assistente.";
                }
            } finally {
                isSending.value = false;
                stopLoadingTextCycle(); 
                
                if (streamingMessageRef.value) {
                    streamingMessageRef.value.isTyping = false;
                    if (!streamingMessageRef.value.text) {
                         streamingMessageRef.value.text = "Sem resposta.";
                    }
                }
                setMessageHistory([...messages.value]);
            }
        };

        const handleKeydown = (e) => { 
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                sendMessage(); 
            } 
        };

        const triggerFileInput = () => fileInputElement.value.click();

        onMounted(() => { 
            if (props.content?.welcomeMessage) {
                addMessage(props.content.welcomeMessage, 'bot'); 
            }
        });

        return { 
            messages, inputText, isSending, brandName, brandColor, botLogoUrl, statusText,
            renderMarkdown, updateTextareaHeight, handleKeydown, sendMessage, 
            messagesContainer, textareaInput, triggerFileInput, fileInputElement,
            currentLoadingText, getSplitText, currentPhraseIndex, shouldShowSkeleton,
            theme // Exposto para o template
        };
    }
};
</script>

<style lang="scss" scoped>
/* Definição de Variáveis */
.looply-chat-app {
    /* Tema Padrão (Light) */
    --bg: #fafaf9;
    --panel: #f5f5f4;
    --text: #1c1917;
    --accent: v-bind(brandColor);
    --border: #F5F5F4;
    --bubble-bot-bg: #F5F5F4;
    --skeleton-base: rgba(0,0,0,0.06);
    --skeleton-shine: rgba(0,0,0,0.15);
    
    width: 100%; height: 100%; 
    padding: 0; /* Removido padding externo */
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

    /* Tema Dark (ativado via atributo de dados) */
    &[data-theme="dark"] {
        --bg: #1c1917;
        --panel: #292524;
        --text: #fafaf9;
        --border: #44403c;
        --bubble-bot-bg: #292524;
        --skeleton-base: rgba(255,255,255,0.08);
        --skeleton-shine: rgba(255,255,255,0.18);
    }
}

.chat-card {
    display: grid; grid-template-rows: auto 1fr auto auto; height: 100%;
    background: var(--panel); 
    border-radius: 0; /* Removido borda arredondada */
    border: none; /* Removido borda */
    overflow: hidden;
    box-shadow: none; /* Removido sombra */
    color: var(--text);
}

.header { padding: 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border); background: var(--panel); }

.brand-logo { 
    width: 36px; height: 36px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }

.brand-name { font-weight: 700; color: var(--text); }
.status { 
    margin-left: auto; 
    font-size: 11px; 
    padding: 4px 10px; 
    background: var(--bg); 
    border: 1px solid var(--border);
    color: var(--text); 
    opacity: 0.8;
    border-radius: 999px; 
}

.messages { padding: 20px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; background: var(--bg); }
.row { display: flex; gap: 10px; align-items: flex-end; &.user { justify-content: flex-end; } }

.avatar { 
    width: 32px; height: 32px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; font-size: 14px; flex-shrink: 0; 
    background: var(--bubble-bot-bg);
}
.avatar.user-icon { background: var(--border); }

.bubble {
    max-width: 85%;
    padding: 12px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; border: 1px solid var(--border);
    min-height: 44px;
    display: flex; flex-direction: column; justify-content: center;
    transition: width 0.3s ease; /* Animação suave na troca de largura */
    
    &.bot { background: var(--bubble-bot-bg); color: var(--text); border-bottom-left-radius: 4px; }
    &.user { background: var(--accent); color: white; border: none; border-bottom-right-radius: 4px; }
    
    /* Quando em loading, força largura de 80% DO CONTAINER PAI (.row) */
    &.loading-state {
        width: 80%;
    }
}

.markdown-content :deep(p) { margin: 0; }
.markdown-content :deep(p + p) { margin-top: 8px; }
.markdown-content :deep(code) { background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 4px; }

/* Skeleton Loader Moderno */
.skeleton-loader {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 6px 0;
}

.sk-line {
    height: 10px;
    border-radius: 5px;
    background: linear-gradient(
        90deg, 
        var(--skeleton-base) 0%, 
        var(--skeleton-shine) 50%, 
        var(--skeleton-base) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 2.5s infinite linear;
    
    &.w-100 { width: 100%; }
    &.w-95 { width: 95%; }
    &.w-85 { width: 85%; }
}

/* Estilo do Texto de Status */
.loading-text-wrapper {
    height: 20px; 
    display: flex;
    align-items: center;
    margin-bottom: 6px;
}

.loading-text-container {
    display: inline-block;
}

.char {
    display: inline-block;
    font-size: 12px;
    color: var(--text);
    opacity: 0.7;
    font-weight: 500;
}

/* Animação Staggered Fade (Letra por Letra) */
.staggered-fade-enter-active,
.staggered-fade-leave-active {
    transition: opacity 0.5s ease, transform 0.5s ease;
}

.staggered-fade-enter-from {
    opacity: 0;
    transform: translateY(2px);
}
.staggered-fade-leave-to {
    opacity: 0;
    transform: translateY(-2px);
    position: absolute;
}

@keyframes shimmer { 
    0% { background-position: -200% 0; } 
    100% { background-position: 200% 0; } 
}

.composer { padding: 12px 16px; display: flex; gap: 10px; align-items: center; background: var(--panel); border-top: 1px solid var(--border); }
.field {
    flex: 1; display: flex; align-items: center; gap: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 20px; padding: 8px 12px;
    textarea {
        flex: 1; border: none; outline: none; background: transparent; font-size: 14px; resize: none; height: 21px; max-height: 160px; line-height: 21px; font-family: inherit; color: var(--text);
    }
}

.icon-btn { color: #78716c; cursor: pointer; display: flex; align-items: center; svg { width: 20px; height: 20px; } }
.send-btn { 
    background: var(--accent); color: white; width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; 
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.2s;
    &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.meta { font-size: 10px; margin-top: 4px; display: block; opacity: 0.6; }
.hint { font-size: 11px; text-align: center; color: #78716c; padding: 8px 0; background: var(--panel); }
</style>
