<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore, useUserStore, useGlobalSettingsStore } from '@/stores'
import { handleOAuthCallback } from '@/api/oauth'
import { getNavMenus } from '@/router/i18n-menu'
import { filterMenusByPermission } from '@/utils/permission'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const userStore = useUserStore()
const globalSettingsStore = useGlobalSettingsStore()
const { t } = useI18n()

const loading = ref(true)
const errorMessage = ref('')

const navMenus = computed(() => getNavMenus(t))

onMounted(async () => {
  const code = route.query.code as string
  const state = route.query.state as string
  
  console.log('[OAuth Callback] 开始处理回调', { code: code?.substring(0, 10) + '...', state: state?.substring(0, 10) + '...' })
  
  if (!code || !state) {
    console.error('[OAuth Callback] 缺少参数')
    errorMessage.value = t('login.oauthCallbackError')
    loading.value = false
    return
  }
  
  try {
    // 处理回调,获取 token
    console.log('[OAuth Callback] 调用后端 callback API...')
    const response = await handleOAuthCallback(code, state)
    console.log('[OAuth Callback] 收到后端响应', { userName: response.user_name, superUser: response.super_user })
    
    // 保存用户信息
    const userPayload = {
      superUser: response.super_user,
      userID: response.user_id,
      userName: response.user_name,
      avatar: response.avatar,
      level: response.level,
      permissions: response.permissions,
      wizard: response.wizard,
    }
    
    const userPermissions = {
      is_superuser: userPayload.superUser,
      ...userPayload.permissions,
    }
    
    const filteredMenus = filterMenusByPermission(navMenus.value, userPermissions)
    console.log('[OAuth Callback] 过滤后的菜单数量:', filteredMenus.length)
    
    if (filteredMenus.length === 0) {
      console.error('[OAuth Callback] 用户无权限访问任何菜单')
      errorMessage.value = t('login.noPermission')
      loading.value = false
      return
    }
    
    // 保存认证信息
    console.log('[OAuth Callback] 保存认证信息到 store...')
    authStore.login({
      token: response.access_token,
      remember: true,
    })
    userStore.loginUser(userPayload)
    console.log('[OAuth Callback] Store 更新完成')
    
    // 加载用户设置
    console.log('[OAuth Callback] 加载用户设置...')
    try {
      await Promise.race([
        globalSettingsStore.loadUserSettings(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('loadUserSettings timeout')), 5000))
      ])
      console.log('[OAuth Callback] 用户设置加载完成')
    } catch (settingsError) {
      console.warn('[OAuth Callback] 用户设置加载失败，继续跳转:', settingsError)
    }
    
    // 跳转 - 排除回调页面本身避免无限循环
    let targetPath = filteredMenus[0].to
    if (authStore.originalPath && 
        authStore.originalPath !== '/' && 
        !authStore.originalPath.startsWith('/oauth/callback') &&
        !authStore.originalPath.startsWith('/login')) {
      targetPath = authStore.originalPath
    }
    
    console.log('[OAuth Callback] 准备跳转到:', targetPath)
    await router.push(targetPath)
    console.log('[OAuth Callback] 跳转完成')
  } catch (error: any) {
    console.error('[OAuth Callback] 处理失败:', error)
    errorMessage.value = error.message || t('login.oauthCallbackError')
    loading.value = false
  }
})
</script>

<template>
  <div class="d-flex flex-column align-center justify-center min-h-screen">
    <VProgressCircular v-if="loading" indeterminate color="primary" size="64" />
    
    <VAlert v-if="errorMessage" type="error" variant="tonal" class="mt-4 mx-4" max-width="400">
      {{ errorMessage }}
      <VBtn variant="text" class="mt-2" block @click="router.push('/login')">
        {{ t('login.backToLogin') }}
      </VBtn>
    </VAlert>
  </div>
</template>
