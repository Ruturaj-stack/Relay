import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  CloudOff,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  QrCode,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  WifiOff,
} from 'lucide-react'
import type { z } from 'zod'
import { signInSchema, signUpSchema } from '@/lib/validation'
import { DEMO_ACCOUNTS } from '@/lib/seed'
import { useSignIn, useSignUp, useCurrentUser } from '@/hooks/useWorkspace'
import { useAppStore } from '@/store/appStore'
import { Avatar, BrandMark, Button, DemoBadge, ImageWithFallback, Wordmark } from '@/components/ui/primitives'
import { TextField } from '@/components/ui/forms'
import { Tabs } from '@/components/ui/tabs'

type SignInValues = z.infer<typeof signInSchema>
type SignUpValues = z.infer<typeof signUpSchema>

export function SignInPage() {
  const { user, isLoading } = useCurrentUser()
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const theme = useAppStore((state) => state.theme)
  const toggleTheme = useAppStore((state) => state.toggleTheme)
  const signIn = useSignIn()
  const signUp = useSignUp()
  const [showPassword, setShowPassword] = useState(false)

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/'

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: 'maya@fieldwork.studio', password: 'relay-demo' },
  })

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', workspaceName: 'Fieldwork Studio' },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg">
        <BrandMark size={42} />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Opening workspace</span>
      </div>
    )
  }

  if (user) return <Navigate to={redirectTo} replace />

  const onSignIn = signInForm.handleSubmit(async (values) => {
    await signIn.mutateAsync(values)
    navigate(redirectTo, { replace: true })
  })

  const onSignUp = signUpForm.handleSubmit(async (values) => {
    await signUp.mutateAsync(values)
    navigate('/', { replace: true })
  })

  const fillDemo = (email: string) => {
    signInForm.setValue('email', email)
    signInForm.setValue('password', 'relay-demo')
    setMode('signin')
  }

  const activeError = mode === 'signin' ? signIn.error?.message : signUp.error?.message
  const pending = signIn.isPending || signUp.isPending

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg">
      <div className="grid min-h-dvh lg:grid-cols-[1.02fr_0.98fr]">
        <BrandPanel />

        <main className="relative flex min-h-dvh flex-col bg-[var(--bg)]">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-8 lg:justify-end">
            <div className="lg:hidden">
              <Wordmark />
            </div>
            <div className="flex items-center gap-2">
              <DemoBadge compact />
              <button
                type="button"
                onClick={toggleTheme}
                className="btn btn-ghost btn-icon btn-sm"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[410px] flex-1 flex-col justify-center px-5 py-10 sm:px-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-7">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-accent">
                  {mode === 'signin' ? 'Your workspace awaits' : 'Start with a clean record'}
                </span>
                <h1 className="mt-2 text-[30px] font-medium leading-tight tracking-[-0.035em] text-ink sm:text-[34px]">
                  {mode === 'signin' ? (
                    <>
                      Welcome back<span className="text-accent">.</span>
                    </>
                  ) : (
                    <>
                      Create your account<span className="text-accent">.</span>
                    </>
                  )}
                </h1>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  {mode === 'signin'
                    ? 'Pick up the handoffs, confirmations and items that need you.'
                    : 'Join the demo workspace and start tracking every transfer.'}
                </p>
              </div>

              <Tabs
                variant="pill"
                value={mode}
                onChange={(value) => {
                  setMode(value as 'signin' | 'signup')
                  signIn.reset()
                  signUp.reset()
                }}
                items={[
                  { value: 'signin', label: 'Sign in' },
                  { value: 'signup', label: 'Create account' },
                ]}
                className="mb-6 w-fit"
              />

              {activeError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 rounded-lg border border-danger/25 bg-danger/8 px-3 py-2.5 text-[11.5px] leading-relaxed text-danger"
                  role="alert"
                >
                  {activeError}
                </motion.div>
              )}

              {mode === 'signin' ? (
                <form onSubmit={onSignIn} className="space-y-3.5">
                  <TextField
                    label="Email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@studio.com"
                    leadingIcon={<Mail size={14} />}
                    error={signInForm.formState.errors.email?.message}
                    {...signInForm.register('email')}
                  />
                  <div>
                    <TextField
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="At least 6 characters"
                      leadingIcon={<Lock size={14} />}
                      error={signInForm.formState.errors.password?.message}
                      {...signInForm.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute mt-[-36px] ml-[calc(100%-34px)] flex h-7 w-7 items-center justify-center text-faint hover:text-ink"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <Button type="submit" variant="primary" size="lg" fullWidth loading={signIn.isPending} iconRight={ArrowRight}>
                    Enter workspace
                  </Button>
                </form>
              ) : (
                <form onSubmit={onSignUp} className="space-y-3.5">
                  <TextField
                    label="Full name"
                    autoComplete="name"
                    placeholder="Your name"
                    leadingIcon={<UserRound size={14} />}
                    error={signUpForm.formState.errors.name?.message}
                    {...signUpForm.register('name')}
                  />
                  <TextField
                    label="Email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@studio.com"
                    leadingIcon={<Mail size={14} />}
                    error={signUpForm.formState.errors.email?.message}
                    {...signUpForm.register('email')}
                  />
                  <TextField
                    label="Password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    leadingIcon={<Lock size={14} />}
                    error={signUpForm.formState.errors.password?.message}
                    {...signUpForm.register('password')}
                  />
                  <TextField
                    label="Workspace name"
                    placeholder="Fieldwork Studio"
                    error={signUpForm.formState.errors.workspaceName?.message}
                    {...signUpForm.register('workspaceName')}
                  />
                  <Button type="submit" variant="primary" size="lg" fullWidth loading={signUp.isPending} iconRight={ArrowRight}>
                    Create demo account
                  </Button>
                </form>
              )}

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-line" />
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">Demo accounts</span>
                <div className="h-px flex-1 bg-line" />
              </div>

              <div className="space-y-1.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => fillDemo(account.email)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-line bg-surface-2/40 px-2.5 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                  >
                    <Avatar profile={{ name: account.name, accent: 'var(--accent)' }} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-medium text-ink">{account.name}</span>
                      <span className="block truncate text-[9.5px] text-faint">{account.role}</span>
                    </span>
                    <span className="flex items-center gap-1 text-[9.5px] text-faint transition-colors group-hover:text-accent">
                      Use <ArrowRight size={10} />
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-5 rounded-lg border border-line bg-surface-2/30 px-3 py-2.5 text-[10px] leading-relaxed text-faint">
                <span className="font-medium text-muted">Demo mode.</span> Accounts, handoffs and photographs live in this
                browser. Authentication is local and any password of 6+ characters works for the seeded accounts. No real
                data is sent anywhere.
              </p>
            </motion.div>
          </div>

          <footer className="flex flex-col gap-2 px-5 pb-6 text-[10px] text-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>RELAY · Built for the things we pass on.</span>
            <span className="font-mono uppercase tracking-[0.12em]">Demo workspace v1.0</span>
          </footer>
        </main>
      </div>
      {pending && <span className="sr-only">Signing in</span>}
    </div>
  )
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-line bg-[#07080a] lg:flex lg:flex-col">
      <div className="accent-grid absolute inset-0 opacity-[0.25]" />
      <div className="absolute -left-32 top-1/4 h-[420px] w-[420px] rounded-full bg-accent/[0.09] blur-[120px]" />
      <div className="absolute -bottom-20 right-0 h-[340px] w-[340px] rounded-full bg-[#8fb6ff]/[0.06] blur-[100px]" />
      <div className="relative z-10 flex items-center justify-between px-9 pt-8">
        <Wordmark />
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/30">A handoff ledger</span>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center px-9 pb-8 xl:px-14">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[540px]"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/45">
            <span className="h-1 w-1 rounded-full bg-accent" />
            Proof for every pass
          </div>
          <h1 className="text-[48px] leading-[0.98] tracking-[-0.045em] text-[#f1efe8] xl:text-[62px]">
            Every handoff,
            <br />
            <span className="display italic text-accent">accounted for.</span>
          </h1>
          <p className="mt-5 max-w-[430px] text-[13px] leading-relaxed text-white/45">
            Laptops, keys, cameras, contracts — the things that move between people. RELAY gives every transfer a
            responsible owner, a timestamp and a proof you can trust.
          </p>

          <div className="mt-10 grid gap-2.5 sm:grid-cols-2">
            <Feature icon={QrCode} title="Scan to confirm" body="A real QR handshake, not a checkbox." />
            <Feature icon={ShieldCheck} title="Trust record" body="Every action, person and condition." />
            <Feature icon={WifiOff} title="Offline-first" body="Prepare handoffs anywhere. Sync later." />
            <Feature icon={Sparkles} title="Return signals" body="Know which handoffs may need a nudge." />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 max-w-[470px]"
        >
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md">
            <div className="flex items-start gap-3">
              <ImageWithFallback
                src="/img/laptop.jpg"
                alt="MacBook Pro"
                className="h-[66px] w-[74px] shrink-0 rounded-lg border border-white/10"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">H-2041</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-info/25 bg-info/10 px-2 py-0.5 text-[9px] text-info">
                    <span className="h-1 w-1 rounded-full bg-info" /> In transit
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] font-medium text-white/90">MacBook Pro 14"</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    <Avatar profile={{ name: 'Maya Chen', accent: '#d8f36c' }} size="xs" ring />
                    <Avatar profile={{ name: 'Elias Ward', accent: '#8fb6ff' }} size="xs" ring />
                  </div>
                  <span className="text-[9.5px] text-white/35">Maya → Elias · due in 2 days</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-2.5">
              <div className="flex items-center gap-1.5 text-[9px] text-white/35">
                <Check size={10} className="text-accent" /> Request accepted
              </div>
              <div className="flex items-center gap-1 text-[9px] text-white/35">
                <QrCode size={10} className="text-accent" /> QR ready
              </div>
              <div className="flex items-center gap-1 text-[9px] text-white/35">
                <CloudOff size={10} /> Proof on sync
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between px-1 text-[9px] text-white/25">
            <span>Trust record · 4 events</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-success" /> Demo data
            </span>
          </div>
        </motion.div>
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-white/[0.06] px-9 py-4 font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
        <span>Fieldwork Studio · London</span>
        <span>RELAY 1.0</span>
      </div>
    </aside>
  )
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof QrCode
  title: string
  body: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
      <Icon size={14} className="text-accent" strokeWidth={1.8} />
      <p className="mt-2 text-[11px] font-medium text-white/80">{title}</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-white/32">{body}</p>
    </div>
  )
}
