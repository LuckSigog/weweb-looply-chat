<template>
    <div class="looply-chat-app">
        <div class="chat-card">
            <!-- Header -->
            <div class="header">
                <div class="brand-logo" :style="{ background: brandColor }">
                    {{ brandInitial }}
                </div>
                <div class="brand-name">{{ brandName }}</div>
                <span class="status">{{ statusText }}</span>
            </div>

            <!-- Messages -->
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
                            {{ message.text }}

                            <!-- Attachments -->
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

            <!-- File Preview Bar -->
            <div v-if="selectedFiles.length > 0" class="files">
                <div v-for="(file, index) in selectedFiles" :key="index" class="file">
                    <img v-if="file.type.startsWith('image/')" :src="file.preview" alt="preview" />
                    <span>{{ file.name }}</span>
                    <span class="x" @click="removeFile(index)">✕</span>
                </div>
            </div>

            <!-- Composer -->
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
import { ref, computed, watch, nextTick, onMounted } from 'vue';

export default {
    name: 'LooplyChat',
    props: {
        content: {
            type: Object,
            required: true
        },
        uid: {
            type: String,
            required: true
        },
        /* wwEditor:start */
        wwEditorState: {
            type: Object,
            required: true
        }
        /* wwEditor:end */
    },
    emits: ['trigger-event'],
    setup(props, { emit }) {
        const isEditing = computed(() => {
            /* wwEditor:start */
            return props.wwEditorState.isEditing;
            /* wwEditor:end */
            // eslint-disable-next-line no-unreachable
            return false;
        });

        // Refs
        const messagesContainer = ref(null);
        const textareaInput = ref(null);
        const fileInputElement = ref(null);

        // State
        const messages = ref([]);
        const inputText = ref('');
        const selectedFiles = ref([]);
        const isSending = ref(false);
        const sessionId = ref(null);

        // Streaming State
        const streamingMessageRef = ref(null);
        const lastProcessedStreamInput = ref('');

        // Computed
        const brandName = computed(() => props.content?.brandName || 'LOOPLY');
        const brandInitial = computed(() => (props.content?.brandName || 'L').charAt(0).toUpperCase());
        const brandColor = computed(() => props.content?.brandColor || '#ef4444');
        const statusText = computed(() => props.content?.statusText || 'online');
        const webhookUrl = computed(() => props.content?.webhookUrl || '');
        const clientId = computed(() => props.content?.clientId || 'cliente-demo-001');
        const welcomeMessage = computed(() => props.content?.welcomeMessage || `Olá! Eu sou a ${brandName.value}. Envie uma mensagem ou anexe arquivos.`);

        // Internal variables
        const { value: messageHistory, setValue: setMessageHistory } = wwLib.wwVariable.useComponentVariable({
            uid: props.uid,
            name: 'messageHistory',
            type: 'array',
            defaultValue: []
        });

        const { value: lastBotMessage, setValue: setLastBotMessage } = wwLib.wwVariable.useComponentVariable({
            uid: props.uid,
            name: 'lastBotMessage',
            type: 'string',
            defaultValue: ''
        });

        // Methods
        const generateSessionId = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            return Math.random().toString(36).slice(2) + Date.now().toString(36);
        };

        const getTimeString = () => {
            return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        const getFileExtension = (name, type) => {
            if (name) {
                const lastDot = name.lastIndexOf('.');
                if (lastDot > -1) {
                    return name.slice(lastDot + 1).toLowerCase().substring(0, 3);
                }
            }
            if (type) {
                const parts = type.split('/');
                return (parts[1] || 'file').substring(0, 3);
            }
            return 'file';
        };

        const scrollToBottom = () => {
            nextTick(() => {
                if (messagesContainer.value) {
                    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
                }
            });
        };

        const addMessage = (text, type = 'bot', attachments = [], isTyping = false) => {
            const message = {
                text: text || '',
                type,
                time: getTimeString(),
                attachments: attachments || [],
                isTyping: isTyping || false
            };
            messages.value.push(message);
            scrollToBottom();
            return message;
        };

        const removeTypingIndicator = () => {
            const typingIndex = messages.value.findIndex(m => m.isTyping);
            if (typingIndex > -1) {
                messages.value.splice(typingIndex, 1);
            }
        };

        const openFile = (url) => {
            if (isEditing.value) return;
            if (url) {
                window.open(url, '_blank');
            }
        };

        const triggerFileInput = () => {
            if (fileInputElement.value) {
                fileInputElement.value.click();
            }
        };

        const handleFileSelect = (event) => {
            const files = Array.from(event.target.files);
            files.forEach(file => {
                const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
                selectedFiles.value.push({
                    file,
                    name: file.name,
                    type: file.type,
                    preview
                });
            });
            event.target.value = '';
        };

        const removeFile = (index) => {
            const file = selectedFiles.value[index];
            if (file.preview) URL.revokeObjectURL(file.preview);
            selectedFiles.value.splice(index, 1);
        };

        const updateTextareaHeight = () => {
            if (textareaInput.value) {
                textareaInput.value.style.height = 'auto';
                textareaInput.value.style.height = `${Math.min(textareaInput.value.scrollHeight, 160)}px`;
            }
        };

        const handleKeydown = (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        };

        const processStreamingData = (input) => {
            if (!input || input === lastProcessedStreamInput.value) return;
            
            // Check if it's actually a streaming JSON format
            if (!input.trim().startsWith('{"type":')) return false;
            
            lastProcessedStreamInput.value = input;

            try {
                // Handle multiple JSON objects in the same string (common in some stream implementations)
                // Using a more robust regex to split JSON objects
                const chunks = input.match(/\{"type":.*?\}(?=\s*\{"type":|$)/g) || [input];

                for (const chunk of chunks) {
                    try {
                        const data = JSON.parse(chunk);

                        if (data.type === 'begin') {
                            removeTypingIndicator();
                            // If we don't have a message ref yet, create one
                            if (!streamingMessageRef.value) {
                                streamingMessageRef.value = addMessage('', 'bot');
                            } else {
                                // If we already have one, clear it for the new node
                                streamingMessageRef.value.text = '';
                            }
                        }
                        else if (data.type === 'item') {
                            removeTypingIndicator();
                            if (!streamingMessageRef.value) {
                                streamingMessageRef.value = addMessage('', 'bot');
                            }
                            
                            // If it's a direct content string from AI Agent
                            if (data.content && data.metadata?.nodeName?.includes('AI Agent')) {
                                streamingMessageRef.value.text += data.content;
                                scrollToBottom();
                            }
                            // If it's the final JSON reply
                            else if (data.metadata?.nodeName?.includes('Return JSON')) {
                                try {
                                    const parsed = JSON.parse(data.content);
                                    if (parsed.reply) {
                                        streamingMessageRef.value.text = parsed.reply;
                                        scrollToBottom();
                                    }
                                } catch (e) {
                                    // If content is just a string in Return JSON, use it
                                    if (data.content) {
                                        streamingMessageRef.value.text = data.content;
                                        scrollToBottom();
                                    }
                                }
                            }
                        }
                        else if (data.type === 'end') {
                            if (streamingMessageRef.value) {
                                const finalBotText = streamingMessageRef.value.text;
                                if (finalBotText) {
                                    setLastBotMessage(finalBotText);

                                    // Update history only if it's the final end of the whole process
                                    // or if we want to save intermediate steps. 
                                    // For now, let's just keep the UI updated.
                                }
                            }
                        }
                    } catch (chunkError) {
                        console.error('Error parsing chunk:', chunkError);
                    }
                }
                return true; // Successfully processed as stream
            } catch (e) {
                console.error('Error in processStreamingData:', e);
                return false;
            }
        };

        const sendMessage = async () => {
            const messageText = inputText.value.trim();
            if (!messageText && selectedFiles.value.length === 0) return;
            if (isSending.value) return;

            const currentFiles = [...selectedFiles.value];
            const currentText = messageText;

            // Reset UI
            inputText.value = '';
            selectedFiles.value = [];
            if (textareaInput.value) textareaInput.value.style.height = '20px';

            // Add user message
            const userAttachments = currentFiles.map(f => ({
                name: f.name,
                type: f.type,
                url: f.preview
            }));
            addMessage(currentText, 'user', userAttachments);

            emit('trigger-event', {
                name: 'messageSent',
                event: {
                    text: currentText,
                    files: currentFiles.map(f => f.file),
                    sessionId: sessionId.value
                }
            });

            isSending.value = true;
            addMessage('', 'bot', [], true); // Typing indicator
            streamingMessageRef.value = null; // Reset stream ref

            try {
                const formData = new FormData();
                formData.append('message', currentText);
                formData.append('sessionId', sessionId.value);
                formData.append('clientId', clientId.value);
                currentFiles.forEach(f => {
                    formData.append('files[]', f.file);
                });

                const response = await fetch(webhookUrl.value, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error('Network response was not ok');

                const responseText = await response.text();
                
                // Try to process as stream first
                const wasStream = processStreamingData(responseText);
                
                if (!wasStream) {
                    // If not a stream, process as normal JSON or text
                    removeTypingIndicator();
                    let data;
                    try {
                        data = JSON.parse(responseText);
                    } catch (e) {
                        data = { reply: responseText };
                    }

                    const botText = (data?.reply || '').toString();
                    const botAttachments = Array.isArray(data?.attachments)
                        ? data.attachments.map(att => ({
                            name: att.name || 'arquivo',
                            type: att.type || '',
                            url: att.url || null,
                            thumb: (att.type || '').startsWith('image/') ? att.url : null
                        }))
                        : [];

                    addMessage(botText, 'bot', botAttachments);
                    setLastBotMessage(botText);

                    // Update history
                    const history = [...(messageHistory.value || [])];
                    history.push({ text: currentText, type: 'user', timestamp: new Date().toISOString() });
                    history.push({ text: botText, type: 'bot', timestamp: new Date().toISOString() });
                    setMessageHistory(history);

                    emit('trigger-event', {
                        name: 'messageReceived',
                        event: {
                            text: botText,
                            attachments: botAttachments,
                            sessionId: sessionId.value
                        }
                    });
                } else {
                    // It was a stream, the messages are already added by processStreamingData
                    // Just update the history with the final result
                    if (streamingMessageRef.value) {
                        const finalBotText = streamingMessageRef.value.text;
                        const history = [...(messageHistory.value || [])];
                        history.push({ text: currentText, type: 'user', timestamp: new Date().toISOString() });
                        history.push({ text: finalBotText, type: 'bot', timestamp: new Date().toISOString() });
                        setMessageHistory(history);
                        
                        emit('trigger-event', {
                            name: 'messageReceived',
                            event: {
                                text: finalBotText,
                                sessionId: sessionId.value
                            }
                        });
                    }
                }

            } catch (error) {
                removeTypingIndicator();
                const errorMessage = `Erro: ${error?.message || 'Falha ao enviar mensagem'}`;
                addMessage(errorMessage, 'bot');

                emit('trigger-event', {
                    name: 'error',
                    event: {
                        message: errorMessage,
                        sessionId: sessionId.value
                    }
                });
            } finally {
                isSending.value = false;
                currentFiles.forEach(f => {
                    if (f.preview) URL.revokeObjectURL(f.preview);
                });
            }
        };

        const clearChat = () => {
            messages.value = [];
            setMessageHistory([]);
            setLastBotMessage('');
            if (welcomeMessage.value) {
                addMessage(welcomeMessage.value, 'bot');
            }
        };

        const addBotMessage = (text, attachments = []) => {
            const processedAttachments = (attachments || []).map(att => ({
                name: att.name || 'arquivo',
                type: att.type || '',
                url: att.url || null,
                thumb: (att.type || '').startsWith('image/') ? att.url : null
            }));
            addMessage(text, 'bot', processedAttachments);
        };

        // Initialize
        onMounted(() => {
            sessionId.value = generateSessionId();
            if (welcomeMessage.value) {
                addMessage(welcomeMessage.value, 'bot');
            }
            if (textareaInput.value) {
                textareaInput.value.style.height = '20px';
            }
        });

        // Watch for external streaming input (e.g. from WeWeb variable)
        watch(() => props.content?.streamingInput, (newValue) => {
            if (props.content?.streamingEnabled && newValue) {
                processStreamingData(newValue);
            }
        });

        return {
            isEditing,
            messagesContainer,
            textareaInput,
            fileInputElement,
            messages,
            inputText,
            selectedFiles,
            isSending,
            brandName,
            brandInitial,
            brandColor,
            statusText,
            getFileExtension,
            openFile,
            triggerFileInput,
            handleFileSelect,
            removeFile,
            updateTextareaHeight,
            handleKeydown,
            sendMessage,
            clearChat,
            addBotMessage
        };
    }
};
</script>

<style lang="scss" scoped>
/* Estilos permanecem os mesmos */
.looply-chat-app {
    --stone-50: #fafaf9;
    --stone-100: #f5f5f4;
    --stone-200: #e7e5e4;
    --stone-300: #d6d3d1;
    --stone-400: #a8a29e;
    --stone-500: #78716c;
    --stone-600: #57534e;
    --stone-700: #44403c;
    --stone-800: #292524;
    --stone-900: #1c1917;
    --stone-950: #0c0a09;
    --red-50: #fef2f2;
    --red-100: #fee2e2;
    --red-200: #fecaca;
    --red-300: #fca5a5;
    --red-400: #f87171;
    --red-500: #ef4444;
    --red-600: #dc2626;
    --red-700: #b91c1c;
    --red-800: #991b1b;
    --red-900: #7f1d1d;
    --red-950: #450a0a;

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

    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 16px;
}

.chat-card {
    display: grid;
    grid-template-rows: auto 1fr auto auto;
    height: 100%;
    border-radius: 16px;
    overflow: hidden;
    background: var(--panel);
    border: 1px solid var(--bubble-border);
    box-shadow: 0 4px 12px var(--shadow-color);
}

.header {
    padding: 16px;
    background: var(--panel);
    border-bottom: 1px solid var(--bubble-border);
    display: flex;
    align-items: center;
    gap: 12px;
}

.brand-logo {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 18px;
}

.brand-name {
    font-weight: 700;
    font-size: 16px;
    color: var(--text);
}

.status {
    margin-left: auto;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--status-bg);
    color: var(--status-text);
}

.messages {
    padding: 20px 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--bg);
}

.row {
    display: flex;
    gap: 10px;
    align-items: flex-end;

    &.bot {
        justify-content: flex-start;
    }

    &.user {
        justify-content: flex-end;
    }
}

.avatar {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    background: var(--bubble-border);
    display: grid;
    place-items: center;
    color: #fff;
    font-weight: 700;
    flex-shrink: 0;
}

.bubble {
    max-width: 70ch;
    padding: 12px 14px;
    border-radius: 16px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-wrap: break-word;
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.07) inset, 0 4px 8px var(--shadow-color);
    position: relative;
    border: 1px solid var(--bubble-border);

    &.user {
        background: var(--bubble-user);
        color: #fff;
        border-top-right-radius: 6px;
    }

    &.bot {
        background: var(--bubble-bot);
        color: var(--text);
        border-top-left-radius: 6px;
    }
}

.meta {
    display: block;
    font-size: 11px;
    opacity: 0.75;
    margin-top: 6px;
}

.typing {
    display: inline-flex;
    gap: 4px;
    align-items: center;

    span {
        width: 6px;
        height: 6px;
        background: var(--text);
        border-radius: 999px;
        display: inline-block;
        animation: blink 1.2s infinite;
        opacity: 0.35;

        &:nth-child(2) {
            animation-delay: 0.15s;
        }

        &:nth-child(3) {
            animation-delay: 0.3s;
        }
    }
}

@keyframes blink {

    0%,
    80%,
    100% {
        opacity: 0.2;
    }

    40% {
        opacity: 1;
    }
}

.attach {
    margin-top: 8px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.chip-file {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--chip-bg);
    color: var(--chip-fg);
    border: 1px solid var(--bubble-border);
    border-radius: 10px;
    padding: 6px 8px;
    font-size: 12px;

    .ext {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        background: rgba(0, 0, 0, 0.06);
        color: inherit;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 10px;
    }

    .name {
        max-width: 240px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
}

.composer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: var(--panel);
    border-top: 1px solid var(--bubble-border);
}

.field {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg);
    border: 1px solid var(--bubble-border);
    border-radius: 14px;
    padding: 8px;

    textarea {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: var(--text);
        padding: 2px;
        font-size: 14px;
        resize: none;
        height: 20px;
        min-height: 20px;
        max-height: 160px;
        overflow: auto;
        line-height: 1.4;
        font-family: inherit;
    }
}

.icon-btn,
.send-btn {
    appearance: none;
    border: none;
    outline: none;
    cursor: pointer;
    display: grid;
    place-items: center;
}

.icon-btn {
    background: var(--bubble-bot);
    width: 36px;
    height: 36px;
    border-radius: 10px;
    color: var(--stone-500);
    flex-shrink: 0;

    svg {
        width: 20px;
        height: 20px;
    }
}

.send-btn {
    background: var(--accent);
    color: #fff;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}

.files {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding: 8px 16px;
    background: var(--panel);
    border-top: 1px solid var(--bubble-border);
}

.file {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--bubble-border);
    background: var(--bg);
    border-radius: 10px;
    padding: 6px 8px;
    font-size: 12px;
    color: var(--text);

    img {
        width: 36px;
        height: 36px;
        object-fit: cover;
        border-radius: 8px;
    }

    .x {
        cursor: pointer;
        opacity: 0.75;
        margin-left: 4px;

        &:hover {
            opacity: 1;
        }
    }
}

.hint {
    font-size: 12px;
    color: var(--stone-500);
    text-align: center;
    padding: 8px 0;
}
</style>
