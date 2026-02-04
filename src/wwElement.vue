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

                    <div class="bubble" :class="message.type">
                        <template v-if="message.isTyping">
                            <span class="typing">
                                <span></span>
                                <span></span>
                                <span></span>
                            </span>
                        </template>
                        <template v-else>
                            <div class="markdown-content" v-html="renderMarkdown(message.text)"></div>

                            <div v-if="message.attachments?.length" class="attach">
                                <div v-for="(file, fileIndex) in message.attachments" :key="fileIndex" class="chip-file"
                                    :style="{ cursor: file.url ? 'pointer' : 'default' }"
                                    :title="file.url ? 'Abrir arquivo' : ''" @click="file.url && openFile(file.url)">
                                    <div v-if="!file.thumb" class="ext">
                                        {{ getFileExtension(file.name, file.type) }}
                                    </div>
                                    <span class="name">{{ file.name || 'arquivo' }}</span>
                                </div>
                            </div>

                            <span class="meta">
                                {{ message.type === 'bot' ? brandName : 'Você' }} • {{ message.time }}
                            </span>
                        </template>
                    </div>

                    <div v-if="message.type === 'user'" class="avatar">👤</div>
                </div>
            </div>

            <div v-if="selectedFiles.length > 0" class="files">
                <div v-for="(file, index) in selectedFiles" :key="index" class="file">
                    <img v-if="file.type.startsWith('image/')" :src="file.preview" alt="preview" />
                    <span>{{ file.name }}</span>
                    <span class="x" @click="removeFile(index)">✕</span>
                </div>
            </div>

            <div class="composer">
                <div class="field">
                    <label class="icon-btn" for="fileInput" role="button" tabindex="0" title="Anexar"
                        @click="triggerFileInput" @keydown.enter="triggerFileInput">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path fill="currentColor" fill-rule="evenodd"
                                d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12m10 5.75a.75.75 0 0 0 .75-.75v-5.19l1.72 1.72a.75.75 0 1 0 1.06-1.06l-3-3a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l1.72-1.72V17c0 .414.336.75.75.75m-4-10a.75.75 0 0 1 0-1.5h8a.75.75 0 0 1 0 1.5z"
                                clip-rule="evenodd" />
                        </svg>
                    </label>
                    <textarea ref="textareaInput" v-model="inputText" placeholder="Escreva sua mensagem…"
                        @keydown="handleKeydown" @input="updateTextareaHeight"></textarea>
                    <input ref="fileInputElement" type="file" multiple style="display: none"
                        @change="handleFileSelect" />
                </div>
                <button class="send-btn" type="button" :disabled="isSending" @click="sendMessage">
                    ➤
                </button>
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
        const isEditing = computed(() => props.wwEditorState?.isEditing || false);
        const messagesContainer = ref(null);
        const textareaInput = ref(null);
        const fileInputElement = ref(null);
        const messages = ref([]);
        const inputText = ref('');
        const selectedFiles = ref([]);
        const isSending = ref(false);
        const sessionId = ref(null);
        const streamingMessageRef = ref(null);
        const streamBuffer = ref('');

        const brandName = computed(() => props.content?.brandName || 'LOOPLY');
        const brandInitial = computed(() => (props.content?.brandName || 'L').charAt(0).toUpperCase());
        const brandColor = computed(() => props.content?.brandColor || '#ef4444');
        const statusText = computed(() => props.content?.statusText || 'online');
        const webhookUrl = computed(() => props.content?.webhookUrl || '');
        const clientId = computed(() => props.content?.clientId || 'cliente-demo-001');
        const welcomeMessage = computed(() => props.content?.welcomeMessage || `Olá! Eu sou a ${brandName.value}.`);

        const { value: messageHistory, setValue: setMessageHistory } = wwLib.wwVariable.useComponentVariable({
            uid: props.uid, name: 'messageHistory', type: 'array', defaultValue: []
        });
        const { setValue: setLastBotMessage } = wwLib.wwVariable.useComponentVariable({
            uid: props.uid, name: 'lastBotMessage', type: 'string', defaultValue: ''
        });

        marked.setOptions({ breaks: true, gfm: true, headerIds: false, mangle: false });
        const renderMarkdown = (text) => text ? marked.parse(text) : '';

        const generateSessionId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
        const getTimeString = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const getFileExtension = (name, type) => name ? name.slice(name.lastIndexOf('.') + 1).toLowerCase().substring(0, 3) : (type?.split('/')[1] || 'file').substring(0, 3);
        const scrollToBottom = () => nextTick(() => { if (messagesContainer.value) messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight; });

        const addMessage = (text, type = 'bot', attachments = [], isTyping = false) => {
            const message = { text: text || '', type, time: getTimeString(), attachments: attachments || [], isTyping: isTyping || false };
            messages.value.push(message);
            scrollToBottom();
            return message;
        };

        const removeTypingIndicator = () => {
            const idx = messages.value.findIndex(m => m.isTyping);
            if (idx > -1) messages.value.splice(idx, 1);
        };

        const openFile = (url) => { if (!isEditing.value && url) window.open(url, '_blank'); };
        const triggerFileInput = () => { if (fileInputElement.value) fileInputElement.value.click(); };
        const handleFileSelect = (e) => {
            Array.from(e.target.files).forEach(file => {
                selectedFiles.value.push({ file, name: file.name, type: file.type, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null });
            });
            e.target.value = '';
        };
        const removeFile = (idx) => {
            if (selectedFiles.value[idx].preview) URL.revokeObjectURL(selectedFiles.value[idx].preview);
            selectedFiles.value.splice(idx, 1);
        };
        const updateTextareaHeight = () => {
            if (textareaInput.value) {
                textareaInput.value.style.height = 'auto';
                textareaInput.value.style.height = `${Math.min(textareaInput.value.scrollHeight, 160)}px`;
            }
        };
        const handleKeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

        const processSingleJSON = (jsonStr) => {
            try {
                const data = JSON.parse(jsonStr);
                if (data.type === 'begin' || data.type === 'item') {
                    removeTypingIndicator();
                    if (!streamingMessageRef.value) streamingMessageRef.value = addMessage('', 'bot');
                    if (data.content) {
                        if (data.metadata?.nodeName?.includes('AI Agent')) {
                            streamingMessageRef.value.text += data.content;
                        } else if (data.metadata?.nodeName?.includes('Return JSON')) {
                            try {
                                const parsed = JSON.parse(data.content);
                                if (parsed.reply) streamingMessageRef.value.text = parsed.reply;
                            } catch (e) { streamingMessageRef.value.text = data.content; }
                        }
                        scrollToBottom();
                    }
                }
            } catch (e) {}
        };

        const parseAndProcessChunks = (text) => {
            streamBuffer.value += text;
            let boundary;
            while ((boundary = streamBuffer.value.indexOf('}{')) !== -1) {
                processSingleJSON(streamBuffer.value.slice(0, boundary + 1));
                streamBuffer.value = streamBuffer.value.slice(boundary + 1);
            }
            try {
                const last = streamBuffer.value.trim();
                if (last.startsWith('{') && last.endsWith('}')) {
                    processSingleJSON(last);
                    streamBuffer.value = '';
                }
            } catch (e) {}
        };

        const sendMessage = async () => {
            const text = inputText.value.trim();
            if (!text && selectedFiles.value.length === 0) return;
            if (isSending.value) return;

            const files = [...selectedFiles.value];
            inputText.value = '';
            selectedFiles.value = [];
            if (textareaInput.value) textareaInput.value.style.height = '20px';

            addMessage(text, 'user', files.map(f => ({ name: f.name, type: f.type, url: f.preview })));
            isSending.value = true;
            addMessage('', 'bot', [], true);
            streamingMessageRef.value = null;
            streamBuffer.value = '';

            try {
                const fd = new FormData();
                fd.append('message', text);
                fd.append('sessionId', sessionId.value);
                fd.append('clientId', clientId.value);
                files.forEach(f => fd.append('files[]', f.file));

                const res = await fetch(webhookUrl.value, { method: 'POST', body: fd });
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    parseAndProcessChunks(decoder.decode(value, { stream: true }));
                }

                if (streamingMessageRef.value) {
                    const botText = streamingMessageRef.value.text;
                    setLastBotMessage(botText);
                    const hist = [...(messageHistory.value || [])];
                    hist.push({ text, type: 'user', timestamp: new Date().toISOString() });
                    hist.push({ text: botText, type: 'bot', timestamp: new Date().toISOString() });
                    setMessageHistory(hist);
                    emit('trigger-event', { name: 'messageReceived', event: { text: botText, sessionId: sessionId.value } });
                }
            } catch (err) {
                removeTypingIndicator();
                addMessage(`Erro: ${err.message}`, 'bot');
            } finally {
                isSending.value = false;
                files.forEach(f => f.preview && URL.revokeObjectURL(f.preview));
            }
        };

        onMounted(() => {
            sessionId.value = generateSessionId();
            if (welcomeMessage.value) addMessage(welcomeMessage.value, 'bot');
        });

        return {
            isEditing, messagesContainer, textareaInput, fileInputElement, messages, inputText, selectedFiles, isSending,
            brandName, brandInitial, brandColor, statusText, getFileExtension, openFile, triggerFileInput, handleFileSelect,
            removeFile, updateTextareaHeight, handleKeydown, sendMessage, renderMarkdown
        };
    }
};
</script>

<style lang="scss" scoped>
.looply-chat-app {
    --stone-50: #fafaf9; --stone-100: #f5f5f4; --stone-200: #e7e5e4; --stone-300: #d6d3d1;
    --stone-400: #a8a29e; --stone-500: #78716c; --stone-600: #57534e; --stone-700: #44403c;
    --stone-800: #292524; --stone-900: #1c1917; --stone-950: #0c0a09;
    --red-50: #fef2f2; --red-100: #fee2e2; --red-200: #fecaca; --red-300: #fca5a5;
    --red-400: #f87171; --red-500: #ef4444; --red-600: #dc2626; --red-700: #b91c1c;
    --red-800: #991b1b; --red-900: #7f1d1d; --red-950: #450a0a;

    --bg: v-bind('content?.theme === "dark" ? "var(--stone-950)" : "var(--stone-50)"');
    --panel: v-bind('content?.theme === "dark" ? "var(--stone-900)" : "var(--stone-100)"');
    --text: v-bind('content?.theme === "dark" ? "var(--stone-50)" : "var(--stone-900)"');
    --bubble-user: v-bind('content?.bubbleUserColor || "var(--red-500)"');
    --bubble-bot: v-bind('content?.theme === "dark" ? "var(--stone-800)" : "var(--stone-200)"');
    --bubble-border: v-bind('content?.theme === "dark" ? "var(--stone-700)" : "var(--stone-300)"');
    --accent: v-bind('content?.accentColor || "var(--red-500)"');
    --status-bg: v-bind('content?.theme === "dark" ? "var(--red-900)" : "var(--red-100)"');
    --status-text: v-bind('content?.theme === "dark" ? "var(--red-100)" : "var(--red-700)"');
    --chip-bg: v-bind('content?.theme === "dark" ? "var(--stone-800)" : "var(--stone-200)"');
    --chip-fg: v-bind('content?.theme === "dark" ? "var(--stone-200)" : "var(--stone-800)"');
    --shadow-color: v-bind('content?.theme === "dark" ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.08)"');

    width: 100%; height: 100%; box-sizing: border-box; padding: 16px;
}

.chat-card {
    display: grid; grid-template-rows: auto 1fr auto auto; height: 100%;
    border-radius: 16px; overflow: hidden; background: var(--panel);
    border: 1px solid var(--bubble-border); box-shadow: 0 4px 12px var(--shadow-color);
}

.header { padding: 16px; background: var(--panel); border-bottom: 1px solid var(--bubble-border); display: flex; align-items: center; gap: 12px; }
.brand-logo { width: 36px; height: 36px; border-radius: 999px; background: var(--accent); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 18px; }
.brand-name { font-weight: 700; font-size: 16px; color: var(--text); }
.status { margin-left: auto; font-size: 12px; padding: 4px 8px; border-radius: 999px; background: var(--status-bg); color: var(--status-text); }

.messages { padding: 20px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; background: var(--bg); }
.row { display: flex; gap: 10px; align-items: flex-end; &.bot { justify-content: flex-start; } &.user { justify-content: flex-end; } }
.avatar { width: 36px; height: 36px; border-radius: 999px; background: var(--bubble-border); display: grid; place-items: center; color: #fff; font-weight: 700; flex-shrink: 0; }

.bubble {
    max-width: 70ch; padding: 10px 14px; border-radius: 16px; line-height: 1.45; word-wrap: break-word;
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.07) inset, 0 4px 8px var(--shadow-color); position: relative; border: 1px solid var(--bubble-border);
    &.user { background: var(--bubble-user); color: #fff; border-top-right-radius: 6px; }
    &.bot { background: var(--bubble-bot); color: var(--text); border-top-left-radius: 6px; }
}

.markdown-content {
    display: block;
    :deep(p) { margin: 0 !important; line-height: 1.45; }
    :deep(p + p) { margin-top: 8px !important; }
    :deep(ul), :deep(ol) { margin: 8px 0 8px 20px !important; }
    :deep(li) { margin-bottom: 4px !important; }
    :deep(strong) { font-weight: 700; }
    :deep(a) { color: inherit; text-decoration: underline; }
}

.meta { display: block; font-size: 11px; opacity: 0.7; margin-top: 4px; line-height: 1; }

.typing { display: inline-flex; gap: 4px; align-items: center; padding: 4px 0; span { width: 6px; height: 6px; background: var(--text); border-radius: 999px; animation: blink 1.2s infinite; opacity: 0.35; &:nth-child(2) { animation-delay: 0.15s; } &:nth-child(3) { animation-delay: 0.3s; } } }
@keyframes blink { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }

.attach { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
.chip-file {
    display: flex; align-items: center; gap: 8px; background: var(--chip-bg); color: var(--chip-fg); border: 1px solid var(--bubble-border); border-radius: 10px; padding: 6px 8px; font-size: 12px;
    .ext { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: rgba(0, 0, 0, 0.06); color: inherit; font-weight: 700; text-transform: uppercase; font-size: 10px; }
    .name { max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}

.composer { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--panel); border-top: 1px solid var(--bubble-border); }
.field { flex: 1; display: flex; align-items: center; gap: 6px; background: var(--bg); border: 1px solid var(--bubble-border); border-radius: 14px; padding: 8px;
    textarea { flex: 1; background: transparent; border: none; outline: none; color: var(--text); padding: 2px; font-size: 14px; resize: none; height: 20px; min-height: 20px; max-height: 160px; overflow: auto; line-height: 1.4; font-family: inherit; }
}
.icon-btn, .send-btn { appearance: none; border: none; outline: none; cursor: pointer; display: grid; place-items: center; }
.icon-btn { background: var(--bubble-bot); width: 36px; height: 36px; border-radius: 10px; color: var(--stone-500); flex-shrink: 0; svg { width: 20px; height: 20px; } }
.send-btn { background: var(--accent); color: #fff; width: 42px; height: 42px; border-radius: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; &:disabled { opacity: 0.5; cursor: not-allowed; } }

.files { display: flex; gap: 8px; flex-wrap: wrap; padding: 8px 16px; background: var(--panel); border-top: 1px solid var(--bubble-border); }
.file { display: flex; align-items: center; gap: 8px; border: 1px solid var(--bubble-border); background: var(--bg); border-radius: 10px; padding: 6px 8px; font-size: 12px; color: var(--text); img { width: 36px; height: 36px; object-fit: cover; border-radius: 8px; } .x { cursor: pointer; opacity: 0.75; margin-left: 4px; &:hover { opacity: 1; } } }
.hint { font-size: 12px; color: var(--stone-500); text-align: center; padding: 8px 0; }
</style>
