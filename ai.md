---
name: streaming-message-display
description: A component that displays streaming messages from JSON data streams with support for begin/item/end event types
keywords: streaming, messages, chat, real-time, json
---

#### Streaming Message Display

***Purpose:***
Displays messages from a streaming data source in real-time, supporting a specific JSON format with begin/item/end events.

***Features:***
- Processes streaming JSON data in real-time
- Handles begin/item/end event types
- Parses and displays messages from AI Agent nodes
- Extracts reply content from JSON return nodes
- Shows optional metadata including node ID and timestamp

***Properties:***
- streamingInput: string - The streaming JSON data input in the format {"type":"begin|item|end", "content":"message", "metadata":{...}}
- showMetadata: boolean - When enabled, displays node ID and timestamp for each message

***Events:***
- messageReceived: Triggered when a new message is received. Payload: { message: 'content', metadata: {...} }

***Exposed Variables:***
- parsedMessages: Array of parsed messages from the stream (path: variables['current_element_uid-parsedMessages'])
- isStreaming: Boolean indicating if streaming is currently active (path: variables['current_element_uid-isStreaming'])

***Notes:***
- The component expects streaming data in a specific JSON format with type, content, and metadata fields
- For AI Agent nodes, the content field is displayed directly
- For Return JSON nodes, the component attempts to parse the JSON and extract the "reply" field
- Streaming state is tracked to provide visual feedback during active streaming
