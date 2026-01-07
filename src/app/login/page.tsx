import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="w-full max-w-md">
                <LoginForm />
                <p className="mt-6 text-center text-xs text-gray-400">
                    &copy; {new Date().getFullYear()} Mahalle Yönetim Sistemi
                </p>
            </div>
        </div>
    )
}
