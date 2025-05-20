// 常量定义
const MODEL_CONFIGS = {
    '酒馆-Flash-Thinking': {
        apiKey: 'sk-123456', // 您原来的key
        apiUrl: 'https://grokyellow.96ai.top/v1/chat/completions',
        modelNameInRequest: '酒馆-Flash-Thinking',
        displayName: '思考模型',
        iconClass: 'fas fa-lightbulb',
        isStreamingDefault: true
    },
    'qwen-plus': {
        apiKey: 'sk-9869cc152d264c1bac1c16c6ecac5128',
        apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        modelNameInRequest: 'qwen-plus',
        displayName: '通义千问-Plus',
        iconClass: 'fas fa-brain', // 为qwen-plus选择一个图标，例如大脑
        isStreamingDefault: true // 假设qwen-plus支持流式输出
    }
};

let CURRENT_MODEL_ID = '酒馆-Flash-Thinking'; // 默认模型ID

// DOM元素
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const modelSelect = document.getElementById('modelSelect'); // 修改：获取新的下拉选择框
const apiStatusIndicator = document.getElementById('apiStatusIndicator');
const apiStatusText = document.getElementById('apiStatusText');

// 新增：欢迎信息相关元素
const welcomeMessage = document.getElementById('welcomeMessage');

// 新会话和历史记录相关元素
const newSessionButton = document.getElementById('newSessionButton');
const historyButton = document.getElementById('historyButton');
const historyModal = document.getElementById('historyModal');
const closeHistoryModal = document.getElementById('closeHistoryModal');
const historyList = document.getElementById('historyList');
const clearHistory = document.getElementById('clearHistory');
const closeHistory = document.getElementById('closeHistory');

// 聊天历史记录
let chatHistory = [];
// 历史会话数组
let conversationHistory = [];

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    // 自动聚焦输入框
    userInput.focus();
    
    // 新增：处理欢迎信息
    if (welcomeMessage) {
        // 用户输入时隐藏欢迎信息
        userInput.addEventListener('input', () => {
            if (userInput.value.length > 0) {
                welcomeMessage.style.display = 'none';
            }
        }, { once: true });
    }
    
    // 调整输入框高度
    userInput.addEventListener('input', autoResizeTextarea);
    
    // 发送按钮点击事件
    sendButton.addEventListener('click', handleSendMessage);
    
    // 回车键发送消息（Shift+Enter换行）
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    
    // 修改：模型选择框改变事件
    modelSelect.addEventListener('change', (e) => {
        CURRENT_MODEL_ID = e.target.value;
        console.log(`模型已更改为: ${MODEL_CONFIGS[CURRENT_MODEL_ID].displayName || CURRENT_MODEL_ID}`);
    });
    
    // 新会话按钮点击事件
    newSessionButton.addEventListener('click', () => {
        if (chatHistory.length > 0) {
            saveCurrentConversation(); 
        }
        chatHistory = [];
        chatContainer.innerHTML = '';
        if (welcomeMessage) welcomeMessage.style.display = 'none';
        userInput.value = '';
        autoResizeTextarea();
        userInput.focus();
        // showNotification('新会话已开始'); // 注释掉这一行以移除提示
    });
    
    // 历史记录按钮点击事件
    historyButton.addEventListener('click', () => {
        historyModal.style.display = 'flex';
        loadConversationHistory();
    });
    
    closeHistoryModal.addEventListener('click', () => {
        historyModal.style.display = 'none';
    });
    closeHistory.addEventListener('click', () => {
        historyModal.style.display = 'none';
    });
    
    clearHistory.addEventListener('click', () => {
        if (confirm('确定要清空所有历史对话记录吗？')) {
            conversationHistory = [];
            localStorage.setItem('conversationHistory', JSON.stringify(conversationHistory));
            historyList.innerHTML = '<div class="empty-history">暂无历史记录</div>';
            showNotification('历史记录已清空');
        }
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === historyModal) {
            historyModal.style.display = 'none';
        }
    });
    
    loadConversationHistoryFromStorage();
    
    scrollToBottom();
    
    testApiConnection();
    
    // 页面加载时设置模型选择框的默认值，并确保 CURRENT_MODEL_ID 有效
    if (!MODEL_CONFIGS[CURRENT_MODEL_ID]) {
        // 如果当前选中的模型ID无效（例如，它刚刚被删除）
        // 则将 CURRENT_MODEL_ID 设置为 MODEL_CONFIGS 中的第一个可用模型的ID
        const firstModelId = Object.keys(MODEL_CONFIGS)[0];
        if (firstModelId) {
            CURRENT_MODEL_ID = firstModelId;
            console.log(`当前模型被重置为: ${MODEL_CONFIGS[CURRENT_MODEL_ID].displayName || CURRENT_MODEL_ID}`);
        } else {
            console.error("没有可用的模型配置!");
            // 在此可以添加更复杂的错误处理，例如禁用UI等
        }
    }
    modelSelect.value = CURRENT_MODEL_ID;
});

// 加载历史会话记录
function loadConversationHistoryFromStorage() {
    try {
        const savedHistory = localStorage.getItem('conversationHistory');
        if (savedHistory) {
            conversationHistory = JSON.parse(savedHistory);
        }
    } catch (error) {
        console.error('加载历史记录出错:', error);
        conversationHistory = [];
    }
}

// 在历史记录窗口中显示历史会话
function loadConversationHistory() {
    historyList.innerHTML = '';
    
    if (conversationHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-history">暂无历史记录</div>';
        return;
    }
    
    // 按时间倒序显示
    conversationHistory.slice().reverse().forEach((conversation, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        // 格式化时间
        const date = new Date(conversation.timestamp);
        const formattedDate = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        // 获取用户的第一条消息作为主要显示内容
        const userFirstMessage = conversation.messages.find(msg => msg.role === 'user')?.content || '对话加载中...'; // Fallback text
        // 调整截断长度，使其在一行内能显示更多，但仍会截断以防止过长
        const mainDisplayText = userFirstMessage.length > 35 ? userFirstMessage.substring(0, 35) + '...' : userFirstMessage;
        
        historyItem.innerHTML = `
            <div class="history-item-line">
                <div class="history-item-main-text">${mainDisplayText}</div>
                <div class="time">${formattedDate}</div>
            </div>
        `;
        
        // 点击加载历史会话
        historyItem.addEventListener('click', () => {
            loadConversation(conversation);
            historyModal.style.display = 'none';
        });
        
        historyList.appendChild(historyItem);
    });
}

// 加载选定的历史会话
function loadConversation(conversation) {
    // 清空当前聊天记录
    chatContainer.innerHTML = '';
    chatHistory = [...conversation.messages];
    
    // 显示历史消息
    conversation.messages.forEach(message => {
        if (message.role !== 'system') {
            addMessageToChat(message.role === 'user' ? 'user' : 'ai', message.content, message.id || null);
        }
    });
    
    // 显示加载成功提示
    showNotification('历史对话已加载');
}

// 显示通知消息
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 2秒后自动消失
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 2000);
}

// 保存当前会话到历史记录
function saveCurrentConversation() {
    // 如果没有消息，不保存
    if (chatHistory.length <= 1) return; // 只有初始消息不保存
    
    // 创建新的会话记录
    const conversation = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        messages: [...chatHistory]
    };
    
    // 添加到历史会话数组
    conversationHistory.push(conversation);
    
    // 限制历史记录数量（最多保存10个会话）
    if (conversationHistory.length > 10) {
        conversationHistory = conversationHistory.slice(-10);
    }
    
    // 保存到本地存储
    localStorage.setItem('conversationHistory', JSON.stringify(conversationHistory));
}

// 处理发送消息
function handleSendMessage() {
    const message = userInput.value.trim();
    if (!message) return;
    
    // 添加用户消息到聊天窗口
    addMessageToChat('user', message);
    
    // 清空输入框并调整大小
    userInput.value = '';
    autoResizeTextarea();
    
    // 显示AI正在输入的指示
    showTypingIndicator();
    
    // 添加消息到历史记录
    chatHistory.push({
        role: 'user',
        content: message
    });
    
    // 发送请求到API
    sendMessageToAPI(message);
}

// 设置API状态指示器
function setApiStatus(status, message) {
    apiStatusIndicator.classList.remove('connected', 'disconnected');
    
    switch (status) {
        case 'connecting':
            apiStatusText.textContent = message || '检查API连接...';
            apiStatusIndicator.style.backgroundColor = '#ffcc00'; // Explicitly sets yellow
            break;
        case 'connected':
            apiStatusText.textContent = message || 'API连接正常';
            apiStatusIndicator.classList.add('connected');
            apiStatusIndicator.style.backgroundColor = ''; // Clear inline style to allow class style to take effect
            break;
        case 'disconnected':
            apiStatusText.textContent = message || 'API连接失败';
            apiStatusIndicator.classList.add('disconnected');
            apiStatusIndicator.style.backgroundColor = ''; // Clear inline style to allow class style to take effect
            break;
    }
}

// 测试API连接
async function testApiConnection() {
    const currentConfig = MODEL_CONFIGS[CURRENT_MODEL_ID];
    if (!currentConfig) {
        console.error("当前模型配置未找到!");
        setApiStatus('disconnected', '模型配置错误');
        return;
    }

    setApiStatus('connecting', `测试 ${currentConfig.displayName || CURRENT_MODEL_ID} 连接...`);
    
    try {
        const testMessage = {
            model: currentConfig.modelNameInRequest,
            messages: [{ role: "user", content: "Hello" }],
            temperature: 0.7,
            max_tokens: 10,
            stream: false // 测试连接通常用非流式
        };
        
        const response = await fetch(currentConfig.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentConfig.apiKey}`
            },
            body: JSON.stringify(testMessage)
        });
        
        if (response.ok) {
            console.log(`${currentConfig.displayName || CURRENT_MODEL_ID} API连接测试成功`);
            setApiStatus('connected', `${currentConfig.displayName || CURRENT_MODEL_ID} 连接正常`);
        } else {
            const errorText = await response.text();
            console.error(`${currentConfig.displayName || CURRENT_MODEL_ID} API连接测试失败:`, response.status, errorText);
            setApiStatus('disconnected', `${currentConfig.displayName || CURRENT_MODEL_ID} 连接失败: ${response.status}`);
        }
    } catch (error) {
        console.error(`${currentConfig.displayName || CURRENT_MODEL_ID} API连接测试错误:`, error);
        setApiStatus('disconnected', `${currentConfig.displayName || CURRENT_MODEL_ID} 连接错误`);
    }
}

// 预处理API响应文本，处理特殊格式问题
function preprocessApiResponse(text) {
    if (!text) return text;
    
    let result = text;
    
    // 处理API返回的转义字符
    result = result.replace(/\\n/g, '\n');
    result = result.replace(/\\"/g, '"');
    result = result.replace(/\\'/g, "'");
    result = result.replace(/\\\\/g, '\\');
    
    // 优化数字列表格式
    // 确保每个列表项前后有足够的空间
    result = result.replace(/(\d+\.\s+[^\n]+)(\n)(\d+\.)/g, '$1\n\n$3');
    
    // 处理特殊情况：列表中的子项目
    result = result.replace(/(\d+\.\s+[^\n]+)(\n\s+-\s+[^\n]+)+/g, function(match) {
        return match.replace(/\n\s+-\s+/g, '\n  • ');
    });
    
    // 增强段落分隔
    result = result.replace(/([.!?])\s*\n\s*([A-Z])/g, '$1\n\n$2');
    
    return result;
}

// 清理响应文本，尝试提取有效的JSON
function cleanResponseText(text) {
    if (!text) return text;
    
    console.log("原始响应文本:", text);
    
    // 尝试寻找JSON开始的位置 (通常是 '{')
    const jsonStartIndex = text.indexOf('{');
    
    // 如果找不到JSON开始标记，返回原始文本
    if (jsonStartIndex === -1) return text;
    
    // 尝试寻找JSON结束的位置 (通常是最后一个 '}')
    const jsonEndIndex = text.lastIndexOf('}');
    
    // 如果找不到JSON结束标记，返回原始文本
    if (jsonEndIndex === -1) return text;
    
    // 提取可能的JSON部分
    const possibleJson = text.substring(jsonStartIndex, jsonEndIndex + 1);
    
    console.log("清理后的响应文本:", possibleJson);
    
    return possibleJson;
}

// 发送消息到API
async function sendMessageToAPI(message) {
    const currentMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sendButton.disabled = true;
    
    const currentConfig = MODEL_CONFIGS[CURRENT_MODEL_ID];
    if (!currentConfig) {
        console.error("当前模型配置未找到!");
        addMessageToChat('ai', '错误：当前模型配置丢失。', currentMessageId);
        sendButton.disabled = false;
        return;
    }

    setApiStatus('connecting', `等待 ${currentConfig.displayName || CURRENT_MODEL_ID} 响应...`);

    const isStreaming = currentConfig.isStreamingDefault; // 使用配置中定义的流式行为

    const requestData = {
        model: currentConfig.modelNameInRequest, // 使用配置中的模型名称
        messages: chatHistory,
        temperature: 0.7,
        max_tokens: 2000,
        stream: isStreaming
    };

    console.log(`发送到 ${currentConfig.displayName || CURRENT_MODEL_ID} API的数据:`, JSON.stringify(requestData));

    if (isStreaming) {
        let accumulatedResponse = '';
        let aiMessageBubbleCreated = false;
        let targetContentDiv = null;
        let typingIndicatorRemoved = false;
        let lastResponseLength = 0;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', currentConfig.apiUrl, true); // 使用配置的API URL
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${currentConfig.apiKey}`); // 使用配置的API Key

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 3 || xhr.readyState === 4) { // LOADING or DONE
                const newResponseText = xhr.responseText.substring(lastResponseLength);
                lastResponseLength = xhr.responseText.length;
                const lines = newResponseText.split('\n');

                lines.forEach(line => {
                    if (line.startsWith('data: ')) {
                        const jsonData = line.substring(6);
                        if (jsonData.trim() === '[DONE]') {
                            // Stream finished by [DONE] signal
                            if (xhr.readyState !== 4) xhr.abort(); // Abort if not already done
                            finalizeStreamedResponse();
                            return;
                        }
                        try {
                            const parsed = JSON.parse(jsonData);
                            if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                                const deltaContent = parsed.choices[0].delta.content;
                                if (deltaContent) {
                                    if (!typingIndicatorRemoved) {
                                        removeTypingIndicator();
                                        typingIndicatorRemoved = true;
                                    }
                                    if (!aiMessageBubbleCreated) {
                                        addMessageToChat('ai', '', currentMessageId); // Create bubble
                                        targetContentDiv = document.getElementById(`ai-content-${currentMessageId}`);
                                        aiMessageBubbleCreated = true;
                                    }
                                    accumulatedResponse += deltaContent;
                                    if (targetContentDiv) {
                                        targetContentDiv.innerText = accumulatedResponse; // Live update with plain text
                                    }
                                    scrollToBottom();
                                }
                            }
                        } catch (e) {
                            console.warn('Error parsing streamed JSON line:', jsonData, e);
                        }
                    }
                });
            }

            if (xhr.readyState === 4) { // DONE
                finalizeStreamedResponse();
                setApiStatus('connected', `${currentConfig.displayName || CURRENT_MODEL_ID} 空闲`);
            }
        };

        xhr.onerror = function() {
            console.error("Stream API request error:", xhr.statusText);
            removeTypingIndicator();
            addMessageToChat('ai', `抱歉，${currentConfig.displayName || CURRENT_MODEL_ID} 连接出现错误: ${xhr.statusText || '网络问题'}`, currentMessageId);
            setApiStatus('disconnected', `${currentConfig.displayName || CURRENT_MODEL_ID} 连接错误: ${xhr.statusText || '网络问题'}`);
            sendButton.disabled = false;
        };
        
        xhr.send(JSON.stringify(requestData));

        function finalizeStreamedResponse() {
            if (targetContentDiv) {
                const finalProcessedContent = preprocessApiResponse(accumulatedResponse);
                targetContentDiv.innerHTML = formatMessage(finalProcessedContent);
                
                // Add action buttons now that content is final
                const actionsDiv = document.getElementById(`ai-actions-${currentMessageId}`);
                if(actionsDiv) addActionButtonsToAIMessage(actionsDiv, finalProcessedContent, currentMessageId);

                chatHistory.push({
                    role: 'assistant',
                    content: finalProcessedContent,
                    id: currentMessageId
                });
                saveCurrentConversation();
            } else if (accumulatedResponse.trim() === '' && typingIndicatorRemoved) {
                 // Stream ended but no content received, or only empty content
                 console.warn('Stream ended with no content after typing indicator was shown.');
                 addMessageToChat('ai', 'AI没有返回有效内容。', currentMessageId);
            } else if (!typingIndicatorRemoved) { // Stream ended quickly, maybe an error or empty response before first chunk
                removeTypingIndicator();
                addMessageToChat('ai', `${currentConfig.displayName || CURRENT_MODEL_ID} 未能成功连接或返回空响应。`, currentMessageId);
            }
            setApiStatus('connected', `${currentConfig.displayName || CURRENT_MODEL_ID} 空闲`);
            sendButton.disabled = false;
            scrollToBottom();
        }

    } else { // Non-streaming part
        try {
            const response = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', currentConfig.apiUrl, true); // 使用配置的API URL
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.setRequestHeader('Authorization', `Bearer ${currentConfig.apiKey}`); // 使用配置的API Key
                
                xhr.onload = function() {
                    if (this.status >= 200 && this.status < 300) {
                        resolve({ ok: true, status: this.status, text: () => Promise.resolve(this.responseText) });
                    } else {
                        resolve({ ok: false, status: this.status, text: () => Promise.resolve(this.responseText) });
                    }
                };
                xhr.onerror = function() { reject(new Error('网络请求失败')); };
                xhr.send(JSON.stringify(requestData));
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("API响应错误:", response.status, errorText);
                setApiStatus('disconnected', `${currentConfig.displayName || CURRENT_MODEL_ID} API请求失败: ${response.status}`);
                throw new Error(`API 请求失败: ${response.status}. ${errorText}`);
            }

            const responseText = await response.text();
            if (!responseText || !responseText.trim()) {
                setApiStatus('disconnected', `${currentConfig.displayName || CURRENT_MODEL_ID} 空响应`);
                throw new Error("API返回了空响应");
            }

            const cleanedText = cleanResponseText(responseText);
            let data;
            try {
                data = JSON.parse(cleanedText);
                console.log("解析后的数据:", data);
                setApiStatus('connected', `${currentConfig.displayName || CURRENT_MODEL_ID} 空闲`);
            } catch (parseError) {
                console.error("JSON解析错误:", parseError);
            
                try {
                    const jsonRegex = /{[:\s\S]*}/;
                    const match = responseText.match(jsonRegex);
                    if (match && match[0]) {
                        data = JSON.parse(match[0]);
                        setApiStatus('connected', `${currentConfig.displayName || CURRENT_MODEL_ID} 修复了响应格式`);
                    } else { throw new Error("无法通过正则表达式提取JSON"); }
                } catch (regexError) {
                    if (responseText.includes("content")) {
                        try {
                            const contentMatch = responseText.match(/"content"\s*:\s*"([^"]*)"/);
                            if (contentMatch && contentMatch[1]) {
                                data = { choices: [{ message: { content: contentMatch[1] } }] };
                                setApiStatus('connected', `${currentConfig.displayName || CURRENT_MODEL_ID} 已手动处理响应`);
                            } else { throw new Error("无法手动提取内容"); }
                        } catch (manualError) {
                            setApiStatus('disconnected', `${currentConfig.displayName || CURRENT_MODEL_ID} 响应格式错误`);
                            removeTypingIndicator();
                            throw new Error(`无法解析API响应: ${parseError.message}`);
                        }
                    } else {
                        setApiStatus('disconnected', `${currentConfig.displayName || CURRENT_MODEL_ID} 响应格式错误`);
                        removeTypingIndicator();
                        throw new Error(`无法解析API响应: ${parseError.message}`);
                    }
                }
            }

            if (data.error) {
                console.error("API返回错误:", data.error);
                setApiStatus('disconnected', `${currentConfig.displayName || CURRENT_MODEL_ID} API错误: ${data.error.message || '未知错误'}`);
                throw new Error(`API错误: ${data.error.message || JSON.stringify(data.error)}`);
            }

            removeTypingIndicator();
            if (data.choices && data.choices.length > 0) {
                let aiResponse = data.choices[0].message.content;
                aiResponse = preprocessApiResponse(aiResponse);
                chatHistory.push({ role: 'assistant', content: aiResponse, id: currentMessageId });
                addMessageToChat('ai', aiResponse, currentMessageId);
                // For non-streaming, add buttons immediately after message is added
                const actionsDiv = document.getElementById(`ai-actions-${currentMessageId}`);
                if(actionsDiv) addActionButtonsToAIMessage(actionsDiv, aiResponse, currentMessageId);
                saveCurrentConversation();
            } else {
                console.error("API响应格式不正确:", data);
                setApiStatus('disconnected', `${currentConfig.displayName || CURRENT_MODEL_ID} 响应格式错误`);
                removeTypingIndicator();
                throw new Error("API响应格式不正确");
            }
        } catch (error) {
            console.error("处理API响应出错:", error);
            removeTypingIndicator();
            addMessageToChat('ai', `抱歉，出现了一个错误: ${error.message}`, currentMessageId);
        } finally {
            sendButton.disabled = false;
        }
    }
}

// 提取创建AI消息按钮的逻辑为一个辅助函数
function addActionButtonsToAIMessage(actionsDiv, contentText, messageId) {
    actionsDiv.innerHTML = ''; // Clear any previous placeholders

    // 复制按钮
    const copyButton = document.createElement('button');
    copyButton.className = 'action-button';
    copyButton.title = '复制';
    copyButton.innerHTML = '<i class="far fa-clone"></i>';
    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(contentText) // Use the final contentText
            .then(() => showNotification('内容已复制到剪贴板'))
            .catch(err => {
                console.error('无法复制文本: ', err);
                showNotification('复制失败');
            });
    });
    actionsDiv.appendChild(copyButton);

    // 重新生成按钮
    if (messageId) {
        const refreshButton = document.createElement('button');
        refreshButton.className = 'action-button';
        refreshButton.title = '重新生成';
        refreshButton.innerHTML = '<i class="fas fa-redo"></i>';
        refreshButton.addEventListener('click', () => {
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) messageElement.remove();

            const indexToRemove = chatHistory.findIndex(msg => msg.id === messageId);
            if (indexToRemove !== -1) {
                chatHistory.splice(indexToRemove, 1);
            } else {
                if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'assistant' && chatHistory[chatHistory.length - 1].content === contentText) {
                    chatHistory.pop();
                } else {
                     showNotification('重新生成失败');
                     return;
                }
            }
            showTypingIndicator();
            sendMessageToAPI(); 
        });
        actionsDiv.appendChild(refreshButton);
    }
}

// 添加消息到聊天窗口
function addMessageToChat(sender, content, messageId = null) {
    // 创建消息容器
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    if (messageId && sender === 'ai') {
        messageDiv.dataset.messageId = messageId;
    }
    
    // 如果是AI消息，在最上方添加模型指示器
    if (sender === 'ai') {
        const currentConfig = MODEL_CONFIGS[CURRENT_MODEL_ID];
        const modelIndicatorDiv = document.createElement('div');
        modelIndicatorDiv.className = 'ai-model-indicator';
        
        let modelDisplayName = CURRENT_MODEL_ID; // 默认显示ID
        let modelIconClass = 'fas fa-microchip'; // 默认图标

        if (currentConfig) {
            modelDisplayName = currentConfig.displayName || CURRENT_MODEL_ID;
            modelIconClass = currentConfig.iconClass || 'fas fa-microchip';
        }
        
        modelIndicatorDiv.innerHTML = `<i class="${modelIconClass}"></i> 由 ${modelDisplayName} 生成`;
        messageDiv.appendChild(modelIndicatorDiv);
    }
    
    // 创建消息内容元素
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    if (sender === 'ai' && messageId) { // 为AI消息内容区设置ID，便于流式更新
        contentDiv.id = `ai-content-${messageId}`;
    }
    
    // 特殊处理AI消息中的数字列表格式
    if (sender === 'ai') {
        // 检查是否包含数字列表
        const hasNumberList = /\d+\.\s+.+(\n|$)/.test(content);
        
        if (hasNumberList) {
            // 预处理内容，确保段落之间有两个换行符
            content = content.replace(/\n(?=\d+\.)/g, '\n\n');
            
            // 标记列表开头的标题或段落
            content = content.replace(/^([^#\n][^\n]+?)\n\n\d+\./m, '$1\n\n###LIST_START###\n\n1.');
            content = content.replace(/^([#]+\s+[^\n]+?)\n\n\d+\./m, '$1\n\n###LIST_START###\n\n1.');
            
            // 在列表结束后添加标记
            const lastNumberMatch = content.match(/\d+\.\s+[^\n]+(\n|$)(?!.*\d+\.)/);
            if (lastNumberMatch) {
                const matchPos = content.indexOf(lastNumberMatch[0]) + lastNumberMatch[0].length;
                if (matchPos < content.length) {
                    content = content.substring(0, matchPos) + '\n\n###LIST_END###\n\n' + content.substring(matchPos);
                } else {
                    content += '\n\n###LIST_END###';
                }
            }
        }
    }
    
    // 处理markdown格式的内容
    contentDiv.innerHTML = formatMessage(content);
    
    // 移除可能添加的标记
    contentDiv.innerHTML = contentDiv.innerHTML.replace(/###LIST_START###|###LIST_END###/g, '');
    
    // 将内容添加到消息中
    messageDiv.appendChild(contentDiv);

    // 如果是AI消息，添加操作按钮
    if (sender === 'ai') {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        actionsDiv.id = `ai-actions-${messageId}`; // 为操作区设置ID，便于流结束后再完整添加

        // 初始时不添加按钮，流结束后再添加，确保content是最终的
        // 按钮的创建逻辑会移到流结束后

        messageDiv.appendChild(actionsDiv);
    }
    
    // 将消息添加到聊天容器
    chatContainer.appendChild(messageDiv);
    
    // 滚动到底部
    scrollToBottom();
}

// 显示"AI正在输入"指示器
function showTypingIndicator() {
    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'message ai-message typing-indicator-container';
    indicatorDiv.id = 'typingIndicator';
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'typing-dot';
        typingIndicator.appendChild(dot);
    }
    
    indicatorDiv.appendChild(typingIndicator);
    chatContainer.appendChild(indicatorDiv);
    
    scrollToBottom();
}

// 移除"AI正在输入"指示器
function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// 自动调整文本区域高度
function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = (userInput.scrollHeight > 120 ? 120 : userInput.scrollHeight) + 'px';
}

// 滚动到聊天窗口底部
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 格式化消息内容（基础markdown支持）
function formatMessage(text) {
    // 转义HTML特殊字符
    let formattedText = escapeHTML(text);
    
    // 检测是否有替换掉的\n\n（这常在API响应中出现）
    formattedText = formattedText.replace(/\\n\\n/g, '\n\n');
    formattedText = formattedText.replace(/\\n/g, '\n');
    
    // 确保列表项前后有空行
    formattedText = formattedText.replace(/(\n|^)(\d+\.\s)/g, '\n\n$2');
    formattedText = formattedText.replace(/(\n|^)([-*]\s)/g, '\n\n$2');
    
    // 段落处理 - 将连续两个换行符转换为段落标签
    const paragraphs = formattedText.split(/\n\n+/);
    
    // 处理段落内容
    for (let i = 0; i < paragraphs.length; i++) {
        let para = paragraphs[i].trim();
        
        if (!para) continue;
        
        // 标题处理
        if (para.startsWith('# ')) {
            paragraphs[i] = '<h1>' + para.substring(2) + '</h1>';
            continue;
        } else if (para.startsWith('## ')) {
            paragraphs[i] = '<h2>' + para.substring(3) + '</h2>';
            continue;
        } else if (para.startsWith('### ')) {
            paragraphs[i] = '<h3>' + para.substring(4) + '</h3>';
            continue;
        }
        
        // 处理有序列表
        if (/^\d+\.\s/.test(para)) {
            const listItems = para.split(/\n/).filter(item => item.trim());
            let listHTML = '<ol>';
            
            for (const item of listItems) {
                // 确保是列表项
                if (/^\d+\.\s/.test(item)) {
                    // 去掉编号和点
                    const content = item.replace(/^\d+\.\s/, '');
                    listHTML += '<li>' + formatInlineElements(content) + '</li>';
                } else {
                    // 如果不是列表项格式，也添加进去
                    listHTML += '<li>' + formatInlineElements(item) + '</li>';
                }
            }
            
            listHTML += '</ol>';
            paragraphs[i] = listHTML;
            continue;
        }
        
        // 处理无序列表
        if (/^[-*]\s/.test(para)) {
            const listItems = para.split(/\n/).filter(item => item.trim());
            let listHTML = '<ul>';
            
            for (const item of listItems) {
                if (/^[-*]\s/.test(item)) {
                    const content = item.replace(/^[-*]\s/, '');
                    listHTML += '<li>' + formatInlineElements(content) + '</li>';
                } else {
                    listHTML += '<li>' + formatInlineElements(item) + '</li>';
                }
            }
            
            listHTML += '</ul>';
            paragraphs[i] = listHTML;
            continue;
        }
        
        // 普通段落处理
        paragraphs[i] = '<p>' + formatInlineElements(para) + '</p>';
    }
    
    return paragraphs.join('');
}

// 格式化内联元素（粗体、斜体、链接等）
function formatInlineElements(text) {
    if (!text) return '';
    
    let formatted = text;
    
    // 行内代码 (`code`)
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 粗体 (**text**)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 斜体 (*text*)
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // 链接 ([text](url))
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // 处理单行换行符
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

// 转义HTML特殊字符
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
} 