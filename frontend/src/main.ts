import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
// import { createAuth0 } from '@auth0/auth0-vue'

import App from './App.vue'
import router from './router'
// import { config } from './config'

const app = createApp(App)

app.use(createPinia())
app.use(router)
// app.use(createAuth0({
//     domain: config.AUTH0_DOMAIN,
//     clientId: config.AUTH0_CLIENT_ID,
//     authorizationParams: {
//         redirect_uri: window.location.origin,
//         audience: config.API_BASE_URL
//     },
// }))
app.mount('#app')
