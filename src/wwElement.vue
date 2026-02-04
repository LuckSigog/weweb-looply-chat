<template>
    <div class="looply-chat-app">
        <div class="chat-card">
            <div class="header">
                <div class="brand-logo" :style="{ background: brandColor }">
                    {{ brandInitial }}
                </div>
                <div class="brand-name">{{ brandName }}</div>
                <span class="status">{{ statusText }}</span>
            </div>

            <div ref="messagesContainer" class="messages">
                <div v-for="(message, index) in messages" :key="index" class="row" :class="message.type">
                    <div v-if="message.type === 'bot'" class="avatar">{{ brandInitial }}</div>

                    <div v-if="message.isTyping || (message.text && message.text.trim().length > 0)" 
                         class="bubble" 
                         :class="[message.type, { 'is-typing-bubble': message.isTyping }]">
                        
                        <template v-if="message.isTyping">
                            <div class="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </template>
                        
                        <template v-else>
                            <div class="markdown-content" v-html="renderMarkdown(message.text)"></div>
                            
                            <div v-if="message.attachments?.length" class="attach">
                                <div v-for="(file, fIdx) in message.attachments" :key="fIdx" class="chip-file" @click="file.url && openFile(file.url)">
                                    <div class="ext">{{ getFileExtension(file.name, file.type) }}</div>
                                    <span class="name">{{ file.name }}</span>
                                </div>
                            </div>

                            <span class="meta">{{ message.type === 'bot' ? brandName : 'Você' }} • {{ message.time }}</span>
                        </template>
                    </div>

                    <div v-if="message.type === 'user'" class="avatar">👤</div>
                </div>
            </div>

            <div class="composer">
                <div class="field">
                    <label class="icon-btn" @click="triggerFileInput">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12m10 5.75a.75.75 0 0 0 .75-.75v-5.19l1.72 1.72a.75.75 0 1 0 1.06-1.06l-3-3a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l1.72-1.72V17c0 .414.336.75.75.75m-4-10a.75.75 0 0 1 0-1.5h8a.75.75 0 0 1 0 1.5z"/></svg>
                    </label>
                    <textarea 
                        ref="textareaInput" 
                        v-model="inputText" 
                        placeholder="Escreva sua mensagem..."
                        rows="1"
                        @keydown="handleKeydown" 
                        @input="updateTextareaHeight"
                    ></textarea>
                </div>
                <button class="send-btn" :disabled="isSending" @click="sendMessage">➤</button>
            </div>
            <div class="hint">Enter envia. Use <strong>Shift+Enter</strong> para quebrar linha.</div>
        </div>
    </div>
</template>

<script>
import { ref, computed, nextTick, onMounted } from 'vue';
import { marked } from 'marked';

export default {
    props: ['content', 'uid', 'wwEditorState'],
    emits: ['trigger-event'],
    setup(props, { emit } ) {
        const messagesContainer = ref(null);
        const textareaInput = ref(null);
        const messages = ref([]);
        const inputText = ref('');
        const isSending = ref(false);
        const streamingMessageRef = ref(null);
        const streamBuffer = ref('');

        const brandName = computed(() => props.content?.brandName || 'LOOPLY');
        const brandInitial = computed(() => (brandName.value).charAt(0).toUpperCase());
        const brandColor = computed(() => props.content?.brandColor || '#ef4444');

        const { setValue: setLastBotMessage } = wwLib.wwVariable.useComponentVariable({ uid: props.uid, name: 'lastBotMessage', type: 'string', defaultValue: '' });

        marked.setOptions({ breaks: true, gfm: true });
        const renderMarkdown = (t) => t ? marked.parse(t) : '';
        const scrollToBottom = () => nextTick(() => { if (messagesContainer.value) messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight; });

        const addMessage = (text, type = 'bot', attachments = [], isTyping = false) => {
            const msg = { text, type, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), attachments, isTyping };
            messages.value.push(msg);
            scrollToBottom();
            return msg;
        };

        const updateTextareaHeight = () => {
            const el = textareaInput.value;
            if (el) {
                el.style.height = '24px';
                el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden';
            }
        };

        // Processamento melhorado para evitar bolhas vazias durante o stream
        const processSingleJSON = (jsonStr) => {
            try {
                const data = JSON.parse(jsonStr);
                if (data.type === 'begin' || data.type === 'item') {
                    // Removemos o indicador de "pensando" assim que o primeiro dado chega
                    const typingIdx = messages.value.findIndex(m => m.isTyping);
                    if (typingIdx > -1) messages.value.splice(typingIdx, 1);

                    // Se não temos uma mensagem de stream ativa, criamos uma
                    if (!streamingMessageRef.value) {
                        streamingMessageRef.value = addMessage('', 'bot');
                    }

                    if (data.content) {
                        streamingMessageRef.value.text += data.content;
                        scrollToBottom();
                    }
                }
            } catch (e) {}
        };

        const sendMessage = async () => {
            if (!inputText.value.trim() || isSending.value) return;
            const text = inputText.value;
            inputText.value = '';
            if (textareaInput.value) textareaInput.value.style.height = '24px';

            addMessage(text, 'user');
            isSending.value = true;
            
            // Adiciona o indicador visual de digitando (os 3 pontinhos)
            addMessage('', 'bot', [], true);
            streamingMessageRef.value = null;

            try {
                const res = await fetch(props.content.webhookUrl, { 
                    method: 'POST', 
                    body: JSON.stringify({ message: text, sessionId: props.uid }),
                    headers: { 'Content-Type': 'application/json' }
                });

                const reader = res.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value, { stream: true });
                    streamBuffer.value += chunk;

                    // Lógica para lidar com múltiplos JSONs no mesmo chunk (comum em n8n/Dify)
                    let boundary;
                    while ((boundary = streamBuffer.value.indexOf('}{')) !== -1) {
                        processSingleJSON(streamBuffer.value.slice(0, boundary + 1));
                        streamBuffer.value = streamBuffer.value.slice(boundary + 1);
                    }
                    processSingleJSON(streamBuffer.value);
                    streamBuffer.value = '';
                }
            } catch (e) {
                addMessage("Erro de conexão.", "bot");
            } finally {
                isSending.value = false;
            }
        };

        const handleKeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
        onMounted(() => { if (props.content?.welcomeMessage) addMessage(props.content.welcomeMessage, 'bot'); });

        return { messages, inputText, isSending, brandName, brandInitial, brandColor, renderMarkdown, updateTextareaHeight, handleKeydown, sendMessage, messagesContainer, textareaInput };
    }
};
</script>

<style lang="scss" scoped>
/* Mesmos estilos anteriores com pequenos ajustes de respiro */
.looply-chat-app {
    --bg: #ffffff;
    --panel: #f5f5f4;
    --accent: v-bind(brandColor);
    --border: #e7e5e4;
    padding: 16px;
    height: 100%;
}

.chat-card {
    display: grid; grid-template-rows: auto 1fr auto auto; height: 100%;
    background: var(--panel); border-radius: 16px; border: 1px solid var(--border); overflow: hidden;
}

.messages { 
    padding: 24px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 24px; background: var(--bg); 
}

.row { display: flex; gap: 12px; align-items: flex-end; &.user { justify-content: flex-end; } }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--border); display: grid; place-items: center; font-size: 14px; flex-shrink: 0; }

.bubble {
    max-width: 80%; padding: 12px 16px; border-radius: 18px; font-size: 14px; line-height: 1.5; position: relative; border: 1px solid var(--border);
    &.bot { background: #f3f4f6; color: #1c1917; border-bottom-left-radius: 4px; }
    &.user { background: var(--accent); color: white; border-bottom-right-radius: 4px; border: none; }
    &.is-typing-bubble { padding: 14px 20px; background: #f3f4f6; border: 1px solid var(--border); }
}

.typing-indicator {
    display: flex; gap: 5px; span { 
        width: 7px; height: 7px; background: #9ca3af; border-radius: 50%; animation: bounce 1.4s infinite;
        &:nth-child(2) { animation-delay: 0.2s; } &:nth-child(3) { animation-delay: 0.4s; }
    }
}
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); opacity: 0.3; } 40% { transform: scale(1.1); opacity: 1; } }

.composer { 
    padding: 16px; display: flex; gap: 12px; align-items: flex-end; background: var(--panel); border-top: 1px solid var(--border);
}

.field {
    flex: 1; background: white; border: 1px solid var(--border); border-radius: 24px; display: flex; align-items: center; padding: 0 14px; min-height: 48px;
    textarea {
        flex: 1; border: none; outline: none; background: transparent; font-size: 15px; line-height: 24px; padding: 12px 0; resize: none; font-family: inherit;
    }
}

.send-btn { 
    width: 44px; height: 44px; border-radius: 50%; background: var(--accent); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
    &:disabled { opacity: 0.4; }
}

.meta { font-size: 10px; margin-top: 6px; display: block; opacity: 0.5; }
.hint { font-size: 11px; text-align: center; color: #78716c; padding: 10px 0; }
</style>
