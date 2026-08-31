import { useState, type FormEvent } from 'react'
import { Wrench } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function Login() {
  const { login, register } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      if (isRegister) await register(name, email, password)
      else await login(email, password)
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha na autenticacao.') } finally { setBusy(false) }
  }

  return <div className="login-page"><div className="login-card"><div className="login-brand"><div className="brand-mark"><Wrench size={24} /></div><strong>AMARO IPHONE</strong><span>Sistema de Gestao</span></div><h2>{isRegister ? 'Criar conta' : 'Entrar no sistema'}</h2><form onSubmit={submit}>{isRegister && <label>Nome completo<input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Seu nome" /></label>}<label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" /></label><label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Minimo 6 caracteres" minLength={6} /></label>{error && <p className="login-error">{error}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Aguarde...' : isRegister ? 'Criar conta' : 'Entrar'}</button></form><button className="login-toggle" onClick={() => { setIsRegister(!isRegister); setError('') }}>{isRegister ? 'Ja tenho conta. Entrar' : 'Nao tenho conta. Criar'}</button></div></div>
}
