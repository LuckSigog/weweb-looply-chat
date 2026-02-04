export default {
editor: {
label: {
en: 'LOOPLY Chat'
},
icon: 'chat'
},
properties: {
webhookUrl: {
label: {
en: 'Webhook URL'
},
type: 'Text',
section: 'settings',
bindable: true,
defaultValue: 'https://webhooks.v4jasson.com.br/webhook/chat-cliente-looply',
/* wwEditor:start */
bindingValidation: {
type: 'string',
tooltip: 'The webhook URL endpoint to send messages to'
},
propertyHelp: {
tooltip: 'Configure the webhook URL where chat messages will be sent. The endpoint should accept POST requests with FormData containing message, sessionId, clientId, and optional files[]'
}
/* wwEditor:end */
},
clientId: {
label: {
en: 'Client ID'
},
type: 'Text',
section: 'settings',
bindable: true,
defaultValue: 'cliente-demo-001',
/* wwEditor:start */
bindingValidation: {
type: 'string',
tooltip: 'A unique identifier for the client'
},
propertyHelp: {
tooltip: 'Set a unique client identifier that will be sent with each message to identify the user'
}
/* wwEditor:end */
},
brandName: {
label: {
en: 'Brand Name'
},
type: 'Text',
section: 'settings',
bindable: true,
defaultValue: 'LOOPLY',
/* wwEditor:start */
bindingValidation: {
type: 'string',
tooltip: 'The name of your brand or bot'
},
propertyHelp: {
tooltip: 'The brand name that will be displayed in the chat header and bot messages'
}
/* wwEditor:end */
},
brandColor: {
label: {
en: 'Brand Color'
},
type: 'Color',
section: 'style',
bindable: true,
defaultValue: '#ef4444',
options: {
nullable: false
},
/* wwEditor:start */
bindingValidation: {
type: 'string',
tooltip: 'A valid CSS color value (hex, rgb, etc.)'
},
propertyHelp: {
tooltip: 'The primary brand color used for the logo, user message bubbles, and accent elements'
}
/* wwEditor:end */
},
statusText: {
label: {
en: 'Status Text'
},
type: 'Text',
section: 'settings',
bindable: true,
defaultValue: 'online',
/* wwEditor:start */
bindingValidation: {
type: 'string',
tooltip: 'The status text to display (e.g., "online", "offline", "away")'
},
propertyHelp: {
tooltip: 'The status indicator text shown in the chat header'
}
/* wwEditor:end */
},
welcomeMessage: {
label: {
en: 'Welcome Message'
},
type: 'Textarea',
section: 'settings',
bindable: true,
defaultValue: 'Olá! Eu sou a LOOPLY. Envie uma mensagem ou anexe arquivos.',
/* wwEditor:start */
bindingValidation: {
type: 'string',
tooltip: 'The initial greeting message from the bot'
},
propertyHelp: {
tooltip: 'The first message displayed when the chat loads, welcoming the user'
}
/* wwEditor:end */
},
theme: {
label: {
en: 'Theme',
pt: 'Tema'
},
type: 'TextRadioGroup',
section: 'style',
bindable: true,
defaultValue: 'light',
options: {
choices: [
{
value: 'light',
title: 'Light',
icon: 'sun'
},
{
value: 'dark',
title: 'Dark',
icon: 'moon'
}
]
},
/* wwEditor:start */
bindingValidation: {
type: 'string',
tooltip: 'A string that defines the theme: "light" or "dark"',
},
propertyHelp: {
tooltip: 'Select the visual theme for the component. Light theme uses bright colors, dark theme uses darker colors for better visibility in low-light environments.',
},
/* wwEditor:end */
},
streamingEnabled: {
label: { en: 'Enable Streaming' },
type: 'OnOff',
section: 'settings',
bindable: true,
defaultValue: false,
/* wwEditor:start */
bindingValidation: {
type: 'boolean',
tooltip: 'Enable or disable streaming data reception'
},
propertyHelp: {
tooltip: 'When enabled, the component will process data as a stream instead of static content'
}
/* wwEditor:end */
},
streamingInterval: {
label: { en: 'Streaming Interval (ms)' },
type: 'Number',
section: 'settings',
bindable: true,
defaultValue: 1000,
options: {
min: 100,
max: 10000,
step: 100
},
hidden: content => !content.streamingEnabled,
/* wwEditor:start */
bindingValidation: {
type: 'number',
tooltip: 'The interval in milliseconds between stream updates'
},
propertyHelp: {
tooltip: 'Set how frequently the component should check for new streaming data (in milliseconds)'
}
/* wwEditor:end */
},
streamingInput: {
label: { en: 'Streaming Input' },
type: 'Text',
section: 'settings',
bindable: true,
defaultValue: '',
/* wwEditor:start */
bindingValidation: {
type: 'string',
tooltip: 'Bind to a streaming data source that provides JSON strings in the format {"type":"begin|item|end", "content":"message", "metadata":{...}}',
},
propertyHelp: {
tooltip: 'Connect to a streaming data source to display real-time messages',
},
/* wwEditor:end */
},
showMetadata: {
label: { en: 'Show Metadata' },
type: 'OnOff',
section: 'settings',
bindable: true,
defaultValue: false,
/* wwEditor:start */
bindingValidation: {
type: 'boolean',
tooltip: 'Toggle display of message metadata (node ID and timestamp)',
},
propertyHelp: {
tooltip: 'When enabled, shows additional information about each message',
},
/* wwEditor:end */
},
},
triggerEvents: [
{
name: 'messageSent',
label: { en: 'On message sent' },
event: {
text: '',
files: [],
sessionId: ''
}
},
{
name: 'messageReceived',
label: { en: 'On message received' },
event: {
text: '',
attachments: [],
sessionId: ''
}
},
{
name: 'error',
label: { en: 'On error' },
event: {
message: '',
sessionId: ''
}
},
{
name: 'streamUpdate',
label: { en: 'On stream update' },
event: { value: null }
},
{
name: 'messageReceived',
label: { en: 'On message received' },
event: { message: '', metadata: {} }
}
],
actions: [
{
label: { en: 'Clear chat' },
action: 'clearChat'
},
{
label: { en: 'Add bot message' },
action: 'addBotMessage',
args: [
{
name: 'text',
type: 'string'
},
{
name: 'attachments',
type: 'array'
}
]
}
]
};
