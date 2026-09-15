import { forwardRef } from 'react'
import { TextInput, type TextInputProps } from 'react-native'
import { radius, space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'

/** A single-line text field on the hairline border, sized like the small button. */
export const Field = forwardRef<TextInput, TextInputProps>(function Field(props, ref) {
  const t = useTheme()
  const type = useType()
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={t.faintForeground}
      {...props}
      style={[
        type.body,
        {
          height: 40,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: radius.md,
          paddingHorizontal: space[3],
          backgroundColor: t.card,
        },
        props.style,
      ]}
    />
  )
})
