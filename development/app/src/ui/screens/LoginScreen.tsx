import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { createAuthService, type RiderRuntimeConfig } from '../../app/config/riderRuntimeConfig'
import { loginAndPersist } from '../../domain/session/riderSession'
import { normalizeDriverPhoneEntry } from '../../domain/phone/phoneEntry'
import type { RiderAuthTokenStore } from '../../domain/riderAuth/riderAuthTokenStore'
import { CountryPhoneInput } from '../components/CountryPhoneInput'

export type LoginScreenProps = {
  config: RiderRuntimeConfig
  store: RiderAuthTokenStore
  onLoggedIn: (accessToken: string) => void
}

const DEFAULT_COUNTRY_ISO2 = 'KR'

export function LoginScreen({ config, store, onLoggedIn }: LoginScreenProps) {
  const [countryIso2, setCountryIso2] = useState(DEFAULT_COUNTRY_ISO2)
  const [nationalPhoneInput, setNationalPhoneInput] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    const auth = createAuthService(config)
    if (auth === null) {
      setError('서버 설정이 없습니다.')
      return
    }

    const normalized = normalizeDriverPhoneEntry({ countryIso2, nationalPhoneInput })
    if (!normalized.ok) {
      setError('전화번호를 확인해주세요.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const result = await loginAndPersist({ auth, store }, { phoneNumber: normalized.phoneE164, name })
      if (result.kind === 'success') {
        onLoggedIn(result.tokens.accessToken)
        return
      }
      if (result.kind === 'invalid_credentials') {
        setError('전화번호 또는 이름이 일치하지 않습니다.')
        return
      }
      setError(result.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>썬더크루 라이더</Text>
      <CountryPhoneInput
        countryIso2={countryIso2}
        nationalPhoneInput={nationalPhoneInput}
        onChangeCountryIso2={setCountryIso2}
        onChangeNationalPhoneInput={setNationalPhoneInput}
      />
      <TextInput
        style={styles.input}
        placeholder="이름"
        autoCapitalize="none"
        value={name}
        onChangeText={setName}
      />
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={submit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? '로그인 중…' : '로그인'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    color: '#dc2626',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#0a58ca',
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
})
