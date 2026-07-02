'use client';

import { useState } from 'react';
import { sendOtpAction, verifyOtpAction } from './actions';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setLoading(true);
    setError('');
    const result = await sendOtpAction(email);
    if (result?.error) { setError(result.error); } else { setStep('code'); }
    setLoading(false);
  }

  async function handleVerify() {
    setLoading(true);
    setError('');
    const result = await verifyOtpAction(email, code);
    if (result?.error) { setError(result.error); }
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-16 gap-6">
      <h1 className="text-2xl font-bold text-center">Tus tarjetas de fidelización</h1>

      {step === 'email' ? (
        <>
          <p className="text-gray-500 text-center text-sm">
            Ingresa tu email para ver tus tarjetas activas.
          </p>
          <input
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full max-w-sm border rounded-xl px-4 py-3 text-base"
          />
          <button
            onClick={handleSend}
            disabled={loading || !email}
            className="w-full max-w-sm bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar código'}
          </button>
        </>
      ) : (
        <>
          <p className="text-gray-500 text-center text-sm">
            Te enviamos un código de 6 dígitos a <strong>{email}</strong>
          </p>
          <input
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={e => setCode(e.target.value)}
            maxLength={6}
            className="w-full max-w-sm border rounded-xl px-4 py-3 text-base text-center text-2xl tracking-widest"
          />
          <button
            onClick={handleVerify}
            disabled={loading || code.length < 6}
            className="w-full max-w-sm bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
          <button onClick={() => setStep('email')} className="text-sm text-gray-400 underline">
            Cambiar email
          </button>
        </>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
