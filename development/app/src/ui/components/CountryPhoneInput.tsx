import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import {
  DRIVER_PHONE_COUNTRIES,
  findDriverPhoneCountry,
  formatDriverNationalPhoneInput,
  searchDriverPhoneCountries,
  type DriverPhoneCountry,
} from '../../domain/phone/phoneEntry'
import {
  COUNTRY_SELECTOR_OVERLAY_BEHAVIOR,
  getCountrySelectorRowText,
  getSelectedCountryCardText,
} from './countrySelectorBehavior'

export type CountryPhoneInputProps = {
  countryIso2: string
  nationalPhoneInput: string
  onChangeCountryIso2(countryIso2: string): void
  onChangeNationalPhoneInput(value: string): void
}

/**
 * Reusable country-selector + national-phone-number input, extracted from the
 * legacy driver onboarding UI in AppRoot.tsx so it can be reused by screens
 * (e.g. LoginScreen) that need country-selected phone entry.
 */
export function CountryPhoneInput({
  countryIso2,
  nationalPhoneInput,
  onChangeCountryIso2,
  onChangeNationalPhoneInput,
}: CountryPhoneInputProps) {
  const [isCountrySelectorOpen, setIsCountrySelectorOpen] = useState(false)
  const [countrySearchQuery, setCountrySearchQuery] = useState('')

  const selectedCountry = findDriverPhoneCountry(countryIso2) ?? DRIVER_PHONE_COUNTRIES[0]
  const visibleCountries = searchDriverPhoneCountries(countrySearchQuery)
  const selectedText = getSelectedCountryCardText(selectedCountry)

  function handleSelectCountry(country: DriverPhoneCountry) {
    onChangeCountryIso2(country.iso2)
    setCountrySearchQuery('')
    setIsCountrySelectorOpen(false)
    onChangeNationalPhoneInput(formatDriverNationalPhoneInput({
      countryIso2: country.iso2,
      nationalPhoneInput,
    }))
  }

  function handlePhoneChangeText(value: string) {
    onChangeNationalPhoneInput(formatDriverNationalPhoneInput({
      countryIso2: selectedCountry.iso2,
      nationalPhoneInput: value,
    }))
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.inputGroup, styles.countrySelectorGroup, isCountrySelectorOpen && styles.countrySelectorGroupOpen]}>
        <Text style={styles.inputLabel}>국가</Text>
        <Pressable
          accessibilityHint={isCountrySelectorOpen ? '국가 검색 목록을 닫습니다.' : '국가 검색 목록을 엽니다.'}
          accessibilityLabel={`국가 ${selectedText.title} ${selectedText.callingCode}`}
          accessibilityRole="button"
          onPress={() => setIsCountrySelectorOpen((current) => !current)}
          style={styles.countrySelectorButton}
        >
          <View style={styles.countrySelectorTextGroup}>
            <Text numberOfLines={1} style={styles.countrySelectorText}>{selectedText.title}</Text>
          </View>
          <Text style={styles.countryCallingCodeText}>{selectedText.callingCode}</Text>
        </Pressable>
        {isCountrySelectorOpen ? (
          <View style={styles.countryListPanel}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setCountrySearchQuery}
              placeholder="국가, ISO, +코드, 로케일, 언어로 검색"
              placeholderTextColor="#8a94a6"
              style={styles.countrySearchInput}
              value={countrySearchQuery}
            />
            <ScrollView nestedScrollEnabled style={styles.countryListScroll}>
              {visibleCountries.length > 0 ? visibleCountries.map((country) => {
                const rowText = getCountrySelectorRowText(country)

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={country.iso2}
                    onPress={() => handleSelectCountry(country)}
                    style={[styles.countryRow, country.iso2 === selectedCountry.iso2 && styles.countryRowSelected]}
                  >
                    <Text numberOfLines={1} style={styles.countrySelectorText}>{rowText.title}</Text>
                    <Text numberOfLines={1} style={styles.helperText}>{rowText.subtitle}</Text>
                  </Pressable>
                )
              }) : <Text style={styles.helperText}>검색 결과와 일치하는 국가가 없습니다.</Text>}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>전화번호</Text>
        <View style={styles.phoneInputShell}>
          <View style={styles.callingCodePill}>
            <Text style={styles.callingCodeText}>{selectedCountry.callingCode}</Text>
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="phone-pad"
            onChangeText={handlePhoneChangeText}
            placeholder="전화번호"
            placeholderTextColor="#8a94a6"
            style={styles.phoneTextInput}
            value={nationalPhoneInput}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 18,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  countrySelectorGroup: {
    overflow: 'visible',
    position: 'relative',
    zIndex: 20,
  },
  countrySelectorGroupOpen: {
    zIndex: COUNTRY_SELECTOR_OVERLAY_BEHAVIOR.zIndex,
  },
  countrySelectorButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d9dee8',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  countrySelectorTextGroup: {
    flex: 1,
  },
  countrySelectorText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  countryCallingCodeText: {
    backgroundColor: '#eef6ff',
    borderRadius: 999,
    color: '#0b57d0',
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countryListPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: 16,
    borderWidth: 1,
    elevation: COUNTRY_SELECTOR_OVERLAY_BEHAVIOR.elevation,
    gap: 10,
    left: 0,
    padding: 12,
    position: COUNTRY_SELECTOR_OVERLAY_BEHAVIOR.position,
    right: 0,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    top: 84,
    zIndex: COUNTRY_SELECTOR_OVERLAY_BEHAVIOR.zIndex,
  },
  countrySearchInput: {
    borderColor: '#d9dee8',
    borderRadius: 12,
    borderWidth: 1,
    color: '#111827',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  countryListScroll: {
    maxHeight: COUNTRY_SELECTOR_OVERLAY_BEHAVIOR.maxVisibleRows * 62,
  },
  countryRow: {
    borderColor: '#eef2f6',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  countryRowSelected: {
    backgroundColor: '#eef6ff',
    borderColor: '#0b57d0',
  },
  helperText: {
    color: '#667085',
    fontSize: 14,
    lineHeight: 20,
  },
  phoneInputShell: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d9dee8',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 10,
  },
  callingCodePill: {
    backgroundColor: '#eef6ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callingCodeText: {
    color: '#0b57d0',
    fontSize: 15,
    fontWeight: '900',
  },
  phoneTextInput: {
    color: '#111827',
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
})
