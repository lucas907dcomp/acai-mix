import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await login({ email, password })
  }

  function handleForgotPassword() {
    window.location.href = `https://clrmxqmihemigdmvspzj.supabase.co/auth/v1/recover`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0720] px-4">
      <Card className="w-full max-w-sm border-[#2d1550] bg-[#1a0b2e]">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-full bg-[#4c1e8c] flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
          </div>
          <CardTitle className="text-white text-2xl">AçaiMix</CardTitle>
          <CardDescription className="text-[#9d7bc8]">
            Entre com suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm text-[#e2d9f3]">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-[#0f0720] border-[#2d1550] text-white placeholder:text-[#4a3570] focus-visible:ring-[#4c1e8c]"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm text-[#e2d9f3]">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-[#0f0720] border-[#2d1550] text-white placeholder:text-[#4a3570] focus-visible:ring-[#4c1e8c]"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#4c1e8c] hover:bg-[#5d2aaa] text-white"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </Button>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="w-full text-sm text-[#9d7bc8] hover:text-[#e2d9f3] transition-colors text-center"
            >
              Esqueci minha senha
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
