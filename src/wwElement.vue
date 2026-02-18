<template>
    <div class="looply-chat-app">
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

                    <!-- Condição ajustada para evitar o vácuo visual: 
                         Mostra o balão se estiver digitando ou se tiver qualquer conteúdo -->
                    <div v-if="message.isTyping || (message.text !== undefined && message.text.length > 0)" 
                         class="bubble" :class="message.type">
                        
                        <template v-if="message.isTyping">
                            <span class="typing">
                                <span></span><span></span><span></span>
                            </span>
                        </template>
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

        const brandName = computed(() => props.content?.brandName || 'LOOPLY');
        const brandColor = computed(() => props.content?.brandColor || '#ef4444');
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
                text, 
                type, 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                isTyping 
            };
            messages.value.push(msg);
            scrollToBottom();
            return msg;
        };

        const updateTextareaHeight = () => {
            if (textareaInput.value) {
                textareaInput.value.style.height = 'auto';
                textareaInput.value.style.height = `${Math.min(textareaInput.value.scrollHeight, 160)}px`;
            }
        };

        const removeTypingIndicator = () => {
            const typingIdx = messages.value.findIndex(m => m.isTyping);
            if (typingIdx > -1) messages.value.splice(typingIdx, 1);
        };

        const handleJsonChunk = (jsonStr) => {
            if (!jsonStr.trim()) return;
            try {
                const data = JSON.parse(jsonStr);
                
                // Trata o início da resposta: Apenas preparamos o ambiente
                if (data.type === 'begin') {
                    // NÃO removemos o typing aqui para evitar o buraco visual na tela
                    if (!streamingMessageRef.value) {
                        // Apenas garantimos que o ref está pronto
                    }
                }

                // Trata o conteúdo da resposta
                if (data.type === 'item' && data.content) {
                    // REMOVE o typing apenas quando o primeiro pedaço de texto real chegar
                    removeTypingIndicator();

                    if (!streamingMessageRef.value) {
                        streamingMessageRef.value = addMessage('', 'bot');
                    }
                    streamingMessageRef.value.text += data.content;
                    scrollToBottom();
                }

                // Trata o fim da resposta
                if (data.type === 'end') {
                    removeTypingIndicator(); // Fallback caso o stream tenha sido muito curto
                }
            } catch (e) {
                throw e; 
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
            addMessage('', 'bot', true); // Adiciona os pontinhos de "digitando"
            streamingMessageRef.value = null;
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
                removeTypingIndicator();
                addMessage("Ocorreu um problema ao conectar com o assistente.", "bot");
            } finally {
                isSending.value = false;
                removeTypingIndicator(); // Garantia final
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
            messagesContainer, textareaInput, triggerFileInput, fileInputElement 
        };
    }
};
</script>

<style lang="scss" scoped>
.looply-chat-app {
    --bg: #fafaf9;
    --panel: #f5f5f4;
    --text: #1c1917;
    --accent: v-bind(brandColor);
    --border: #F5F5F4;
    width: 100%; height: 100%; padding: 16px; box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.chat-card {
    display: grid; grid-template-rows: auto 1fr auto auto; height: 100%;
    background: var(--panel); border-radius: 16px; border: 1px solid #e7e5e4; overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.header { padding: 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #e7e5e4; background: var(--panel); }

.brand-logo { 
    width: 36px; height: 36px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }

.brand-name { font-weight: 700; color: var(--text); }
.status { 
    margin-left: auto; 
    font-size: 11px; 
    padding: 4px 10px; 
    background: white; 
    border: 1px solid #e7e5e4;
    color: #444; 
    border-radius: 999px; 
}

.messages { padding: 20px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; background: white; }
.row { display: flex; gap: 10px; align-items: flex-end; &.user { justify-content: flex-end; } }

.avatar { 
    width: 32px; height: 32px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; font-size: 14px; flex-shrink: 0; 
    background: #f3f4f6;
}
.avatar.user-icon { background: #e7e5e4; }

.bubble {
    max-width: 75%; padding: 12px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; border: 1px solid #e7e5e4;
    min-height: 20px; /* Garante uma altura mínima para evitar saltos visuais */
    &.bot { background: #F5F5F4; color: var(--text); border-bottom-left-radius: 4px; }
    &.user { background: var(--accent); color: white; border: none; border-bottom-right-radius: 4px; }
}

.markdown-content :deep(p) { margin: 0; }
.markdown-content :deep(p + p) { margin-top: 8px; }
.markdown-content :deep(code) { background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 4px; }

.typing {
    display: flex; gap: 4px; padding: 4px 0;
    span { 
        width: 6px; height: 6px; background: #9ca3af; border-radius: 50%; animation: blink 1.4s infinite; 
        &:nth-child(2) { animation-delay: 0.2s; } &:nth-child(3) { animation-delay: 0.4s; }
    }
}
@keyframes blink { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }

.composer { padding: 12px 16px; display: flex; gap: 10px; align-items: center; background: var(--panel); border-top: 1px solid #e7e5e4; }
.field {
    flex: 1; display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e7e5e4; border-radius: 20px; padding: 8px 12px;
    textarea {
        flex: 1; border: none; outline: none; background: transparent; font-size: 14px; resize: none; height: 21px; max-height: 160px; line-height: 21px; font-family: inherit;
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
