const ruax = new Ruax()
ruax.defaults.baseUrl = 'https://www.mvi-web.cn/chatSys'//'http://localhost:3032','https://www.mvi-web.cn/chatSys'
const wsUrl = 'wss://www.mvi-web.cn/ws' //'ws://localhost:3031',"wss://www.mvi-web.cn/ws"
new Vue({
	el: '#app',
	data() {
		return {
			//emoji表情包是否显示
			emojiShow: false,
			//发送的消息
			message: '<p><br></p>',
			//连接数
			connections: 0,
			//socket对象
			webSocket: null,
			//消息列表
			list: [],
			//我的用户名称
			userName: '',
			//心跳检测计时器
			timer: null,
			//是否正在连接
			connecting: false,
			//是否正在断开连接
			disconnecting: false,
			//未读消息数
			unread: 0, 
			//编辑器菜单配置
			editorMenus: {
				undo: false,
				redo: false,
				divider: false,
				selectAll: false,
				fontFamily: [{
						label: '楷体',
						value: 'KaiTi'
					},
					{
						label: '仿宋',
						value: 'FangSong'
					},
					{
						label: '宋体',
						value: 'SimSun'
					},
					{
						label: '黑体',
						value: 'SimHei'
					},
					{
						label: '微软雅黑',
						value: 'Microsoft YaHei'
					},
					{
						label: 'PingFang SC',
						value: 'PingFang SC'
					},
					{
						label: 'Helvetica Neue',
						value: 'Helvetica Neue'
					},
					{
						label: 'Arial',
						value: 'Arial'
					},
					{
						label: 'sans-serif',
						value: 'sans-serif'
					}
				],
				list: [],
				quote: false,
				table: [],
				code: false,
				removeFormat: false,
				emoji: true
			},
			//编辑器菜单图标配置
			editorMenuIcons: {
				emoji: 'emoji-alt'
			},
			//编辑器工具提示配置
			editorTooltips: {
				emoji: '表情'
			},
			//编辑器菜单序列
			menuIndex:{
				emoji:-1
			},
			//编辑器上传文件配置
			uploadImageProps: {
				multiple: false,
				allowedFileType: ['jpg', 'png', 'jpeg', 'gif', 'jfif', 'ico', 'webp'],
				accept: 'image',
				minSize: -1,
				maxSize: -1,
				minLength: -1,
				maxLength: -1
			},
			//编辑器悬浮层配置
			layerProps: {
				placement: 'top-start',
				showTriangle: true,
				animation: 'scaleY'
			},
			//滚动到底部监听
			scrollTopBottom: {
				bottom: el => {
					this.unread = 0
				}
			},
			//在线用户列表
			users:[],
			//是否显示在线用户浮层
			onlineShow:false
		}
	},
	computed: {
		//用户名缓存key
		userNameKey() {
			return 'socket-username-' + this.room
		},
		//房间名
		room() {
			return this.$dap.common.getUrlParams('room') || '未命名'
		},
		//编辑器是否为空
		isEmpty() {
			return this.message.trim() == '<p><br></p>' || this.message.trim() == '<p></p>' || this.message
				.trim() == '<br>' || !this.message.trim()
		}
	},
	created() {
		document.title = '即时在线聊天室-'+this.room
	},
	mounted() {
		this.userName = localStorage.getItem(this.userNameKey)
		if (this.userName) {
			this.checkUserName()
		} else {
			this.createUserName()
		}
	},
	methods: {
		//检查用户名称
		checkUserName(){
			ruax.get('/checkUserName',{
				userName:this.userName,
				room:this.room
			}).then(res=>{
				if(res.state == 200){
					this.init()
				}else {
					this.$Alert({
						message: res.message,
						animation: 'scale',
						width:'6rem',
						callback: () => {
							localStorage.removeItem(this.userNameKey)
							this.userName = ''
							this.createUserName()
						},
						btns:{
							ok:{
								size:'small',
								type:'info'
							}
						}
					})
				}
			})
		},
		//创建用户
		createUserName() {
			this.$Prompt({
				title: '设置一个昵称',
				message: '给自己取个名字，方便聊天',
				animation: 'scale',
				placeholder: '请输入昵称',
				clearable: true,
				width:'6rem',
				btns:{
					ok:{
						size:'small',
						type:'info'
					},
					cancel:{
						size:'small'
					}
				},
				callback: (r, value) => {
					if (r && value) {
						localStorage.setItem(this.userNameKey, value)
						this.userName = value
						this.checkUserName()
					} else {
						this.$Alert({
							message: '不设置名称无法聊天',
							animation: 'scale',
							width:'6rem',
							callback: () => {
								this.createUserName()
							},
							btns:{
								ok:{
									size:'small',
									type:'info'
								}
							}
						})
					}
				}
			})
		},
		//初始化
		init() {
			this.connecting = true
			if ('WebSocket' in window) {
				this.webSocket = new WebSocket(wsUrl)
				this.webSocket.onerror = this.onError
				this.webSocket.onopen = this.onOpen
				this.webSocket.onmessage = this.onMessage
				this.webSocket.onclose = this.onClose
				window.onbeforeunload = this.onBeforeUnload
			} else {
				this.$Alert({
					title: '无法连接到聊天室',
					message: '你当前使用的浏览器不支持webSocket，请更换现代浏览器！',
					showTimes: false,
					width:'6rem',
					btns: {
						ok: {
							size: 'small',
							type: 'error'
						}
					}
				})
			}
		},
		//重新连接
		reset() {
			this.list.pop()
			this.init()
		},
		//监听窗口关闭
		onBeforeUnload() {
			if (this.webSocket) {
				this.webSocket.close()
			}
		},
		//连接发生错误的回调方法
		onError(code) {
			console.log("WebSocket连接发生错误", code)
		},
		//连接成功建立的回调方法
		onOpen() {
			console.log('webSocket连接成功')
			this.send(JSON.stringify({
				room: this.room,
				type: 0,
				userName: this.userName
			}))
			//心跳检测
			if (this.timer) {
				clearInterval(this.timer)
				this.timer = null
			}
			this.timer = setInterval(() => {
				this.send(JSON.stringify({
					room: this.room,
					type: -1,
					userName: this.userName
				}))
			}, 30000)
			this.connecting = false
		},
		//接收到消息的回调方法
		onMessage(event) {
			//接收消息之前判断滚动条是否在最底部
			const top = this.$dap.element.getScrollTop(this.$refs.body)
			const height = this.$dap.element.getScrollHeight(this.$refs.body)
			let isBottom = top >= height - this.$refs.body.offsetHeight
			//获取数据
			const data = JSON.parse(event.data)
			//心跳检测回执
			if (data.type == -1) {
				console.log('心跳检测回执', data)
			}
			//加入聊天室
			else if (data.type == 0) {
				console.log('加入聊天室通知', data)
				if (data.data.list) {
					this.list = data.data.list || []
				}
				this.users = data.data.users
				this.connections = data.data.connections
				this.list.push({
					type: data.type,
					content: data.content,
					data: {
						time: data.data.time
					}
				})
			}
			//离开聊天室
			else if (data.type == 1) {
				console.log('离开聊天室通知', data)
				this.connections = data.data.connections
				this.users = data.data.users
				this.list.push({
					type: data.type,
					content: data.content,
					data: {
						time: data.data.time
					}
				})
			}
			//普通消息
			else if (data.type == 2) {
				console.log('普通消息', data)
				this.list.push({
					type: data.type,
					content: data.content,
					userName: data.userName,
					data: {
						time: data.data.time
					}
				})

			}
			//如果滚动条本身在底部，则继续定位到底部
			if (isBottom) {
				this.$nextTick(() => {
					this.goBottom()
				})
			}
			//不在底部则告知未读消息
			else {
				this.unread++
			}
		},
		//连接关闭的回调方法
		onClose() {
			this.connecting = false
			this.disconnecting = false
			this.list.push({
				type: 3,
				content: '你已断开连接，点我重新连接',
				data: {
					time: new Date().toLocaleString('zh-CN', {
						hour12: false
					})
				}
			})
			if (this.timer) {
				clearInterval(this.timer)
				this.timer = null
			}
			this.webSocket = null
			this.$nextTick(() => {
				this.goBottom()
			})
		},
		//关闭socket连接
		closeWebSocket() {
			if (this.webSocket) {
				this.disconnecting = true
				this.webSocket.close()
			}
		},
		//发送消息
		sendMessage(flag) {
			if (this.isEmpty) {
				return
			}
			if (!this.webSocket) {
				return
			}
			if (this.connecting) {
				return
			}
			this.send(JSON.stringify({
				room: this.room,
				type: 2,
				content: this.message.trim(),
				userName: this.userName
			}))
			if (flag) {
				this.clearEditor()
			}
			this.goBottom()
		},
		//清空编辑器
		clearEditor() {
			this.$refs.editor.empty()
		},
		//发送消息api
		send(data) {
			if (this.webSocket && data) {
				this.webSocket.send(data)
			}
		},
		//清空屏幕
		clearScreen() {
			this.list = []
			this.unread = 0
		},
		//到底部
		goBottom() {
			this.$dap.element.setScrollTop({
				el: this.$refs.body,
				number: this.$dap.element.getScrollHeight(this.$refs.body)
			})
			this.unread = 0
		},
		//自定义操作
		customAction(res) {
			if (res.key == 'emoji') {
				this.emojiShow = true
			}
		},
		//选择表情
		sendEmoji(index) {
			const url = `./emoji/emoji-${index+1}.png`
			this.$refs.editor.restoreRange()
			document.execCommand('insertHTML', false, `<img class="app-emoji-show" src="${url}" />`)
			this.emojiShow = false
		}
	},
	beforeDestroy() {
		if (this.timer) {
			clearInterval(this.timer)
			this.timer = null
		}
	}
})
