import { createPinia } from 'pinia'
import { Button } from 'vant'
import { createApp } from 'vue'
import './styles/main.css'
import 'vant/lib/index.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Button)
app.mount('#app')
