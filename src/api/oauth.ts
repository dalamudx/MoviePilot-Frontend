import api from '@/api'

export interface OAuthProvider {
    name: string
    type: 'oidc' | 'oauth2'
}

export interface OAuthEnabledResponse {
    enabled: boolean
    provider: OAuthProvider | null
}

export interface AuthorizeResponse {
    authorization_url: string
}

/**
 * 检查 OAuth 是否启用
 */
export async function checkOAuthEnabled(): Promise<OAuthEnabledResponse> {
    try {
        const response: any = await api.get('/oauth/enabled')
        return response
    } catch (error) {
        console.error('检查 OAuth 状态失败:', error)
        return { enabled: false, provider: null }
    }
}

/**
 * 启动 OAuth 授权流程
 */
export async function startOAuthFlow(redirectPath: string = '/'): Promise<string> {
    const response: AuthorizeResponse = await api.get('/oauth/authorize', {
        params: { redirect_path: redirectPath },
    })
    return response.authorization_url
}

/**
 * 处理 OAuth 回调
 */
export async function handleOAuthCallback(code: string, state: string): Promise<any> {
    return await api.post(`/oauth/callback?code=${code}&state=${state}`)
}
