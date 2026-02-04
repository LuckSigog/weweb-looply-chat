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
        const streamingMessageRef
