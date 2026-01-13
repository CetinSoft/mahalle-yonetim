'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { authenticate } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

function SubmitButton() {
    const { pending } = useFormStatus()

    return (
        <Button className="w-full bg-blue-600 hover:bg-blue-700 font-semibold" type="submit" disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Giriş Yap'}
        </Button>
    )
}

export function LoginForm() {
    const [errorMessage, dispatch, isPending] = useActionState(authenticate, undefined)

    return (
        <form action={dispatch}>
            <Card className="w-full max-w-sm mx-auto shadow-2xl border-none ring-1 ring-gray-100">
                <CardHeader className="space-y-3 pb-4">
                    <div className="flex justify-center">
                        <img
                            src="/muyet-logo.png"
                            alt="MUYET - Mahalle Üye Takibi"
                            className="h-32 w-auto"
                        />
                    </div>
                    <CardTitle className="text-xl font-bold text-center text-blue-900">Mahalle Üye Takibi</CardTitle>
                    <CardDescription className="text-center">
                        Devam etmek için TC Kimlik Numaranızı giriniz.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="tcNo">TC Kimlik No</Label>
                        <Input
                            id="tcNo"
                            name="tcNo"
                            placeholder="12345678901"
                            required
                            type="text"
                            minLength={11}
                            maxLength={11}
                            className="tracking-widest"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Şifre</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            required
                            placeholder="******"
                        />
                    </div>
                    {errorMessage && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md font-medium animate-in fade-in slide-in-from-top-1">
                            {errorMessage}
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    )
}
