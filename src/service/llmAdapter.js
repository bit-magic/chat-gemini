import {
  reqGemini,
  req,
  getModels
} from '@/api'

const controller = new AbortController();

export const abort = controller.abort

export async function* llm(data, signal = controller.signal, enabledTools = false, type = 'openai', model = 'gpt-4o-mini') {
  type = localStorage.getItem("llm-model") || "openai"
  if (type == 'Gemini Pro') {
    if (enabledTools) {
      data.tools = [{
        "functionDeclarations": [{
            "name": "find_weather",
            "description": "获取当前天气",
            "parameters": {
              "type": "OBJECT",
              "properties": {
                "location": {
                  "type": "STRING",
                  "description": "地区名称"
                },
                "description": {
                  "type": "STRING",
                  "description": "任何类型的描述，包括类别或流派、标题词、属性等。"
                }
              },
              "required": ["description"]
            }
          }, {
            "name": "find_webcrawer",
            "description": "查找网络信息，网络爬虫",
            "parameters": {
              "type": "OBJECT",
              "properties": {
                "url": {
                  "type": "STRING",
                  "description": "url,网址"
                },
                "nextaction": {
                  "type": "STRING",
                  "description": "获取内容之后做什么请用中文描述"
                },
              },
              "required": ["url", "nextaction"]
            }
          }, {
            "name": "md2mindmap",
            "description": "- Role: 大纲生成助理 - Description: 旨在帮助用户根据主题编写markdown格式文本的主题大纲， 要求逻辑清晰，层级分明，分条表述。层级不能少于4级",
            "parameters": {
              "type": "OBJECT",
              "properties": {
                "content": {
                  "type": "STRING",
                  "description": "以#开头的markdown格式文本"
                },
              },
              "required": ["content"]
            }
          },
          {
            "name": "find_currenttime",
            "description": "获取当前时间",
          }
        ]
      }]
    }
    for await (const line of (await reqGemini(data, signal))) {
      // console.log(line)
      if (line.includes('{') || line.includes('}')) {
        const start = line.indexOf('{')
        const end = line.lastIndexOf('}')
        let str = ''
        for (let i = start; i <= end; i++) {
          str += line.charAt(i)
        }
        const r = JSON.parse(str);
        if (r.error) {
          yield Promise.reject(r.error.message)
        } else {
          // 存在bug 已修复
          // console.log(line.substr(start, end))
          let part = JSON.parse(str).candidates[0].content.parts[0]
          if (part.text) {
            yield {
              type: 'text',
              data: part.text
            }
          } else if (part.functionCall) {
            yield {
              type: 'functionCall',
              data: part.functionCall
            }
          } else {
            yield {
              type: 'text',
              data: '出现点问题，请重试'
            }
          }
        }

      }
    }
  } else if (type == 'openai') {
    const path = localStorage.getItem('openai-host') || 'https://zhidayingxiao.cn'
    const key = localStorage.getItem('openai-key') || localStorage.getItem('qaiKey')
    let d = (await req(path + '/v1/chat/completions', gptReq(data, model, false), signal, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
    }))
    yield {
      type: 'text',
      data: d.choices[0].message.content
    }
  }
  const sendEvent = new Event("llmEnd")
  document.dispatchEvent(sendEvent)
}


export async function listModel() {
  return (await getModels()).data.map(o => o.id).filter(id => id.includes('gpt-4o-mini') || id.includes('deepseek-'))
}

function gptReq(data, model, enabledTools) {
  console.log(data)
  let messages = []
  data.contents.forEach(item => {
    item.parts.forEach(c => {
      messages.push({
        role: item.role == 'user' ? 'user' : 'assistant',
        content: c.text
      })
    })
  })
  let functions = []
  if (enabledTools) {
    functions = [{
        "name": "find_weather",
        "description": "获取当前天气",
        "parameters": {
          "type": "OBJECT",
          "properties": {
            "location": {
              "type": "STRING",
              "description": "地区名称"
            },
            "description": {
              "type": "STRING",
              "description": "任何类型的描述，包括类别或流派、标题词、属性等。"
            }
          },
          "required": ["description"]
        }
      }, {
        "name": "find_webcrawer",
        "description": "查找网络信息，网络爬虫",
        "parameters": {
          "type": "OBJECT",
          "properties": {
            "url": {
              "type": "STRING",
              "description": "url,网址"
            },
            "nextaction": {
              "type": "STRING",
              "description": "获取内容之后做什么请用中文描述"
            },
          },
          "required": ["url", "nextaction"]
        }
      }, {
        "name": "md2mindmap",
        "description": "- Role: 大纲生成助理 - Description: 旨在帮助用户根据主题编写markdown格式文本的主题大纲， 要求逻辑清晰，层级分明，分条表述。层级不能少于4级",
        "parameters": {
          "type": "OBJECT",
          "properties": {
            "content": {
              "type": "STRING",
              "description": "以#开头的markdown格式文本"
            },
          },
          "required": ["content"]
        }
      },
      {
        "name": "find_currenttime",
        "description": "获取当前时间",
      }
    ]
  }
  return {
    model,
    messages,
    functions: functions.length > 0 ? functions : undefined
  }
}
