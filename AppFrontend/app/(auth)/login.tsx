import firebase, { auth } from "@/config/firebase";
import { Colors } from "@/constants/theme";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type AuthStep = "phone" | "otp";

interface FormErrors {
  phone?: string;
  otp?: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  const [step, setStep] = useState<AuthStep>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const otpInputRefs = useRef<(TextInput | null)[]>([]);

  const firebaseConfig = {
    apiKey: "AIzaSyAOhF__Zk71G6QVQNqayBZDj21MBYmyz8I",
    authDomain: "alertiq-35754.firebaseapp.com",
    projectId: "alertiq-35754",
  };

  const validatePhone = (): boolean => {
    const newErrors: FormErrors = {};
    const cleanedNumber = phoneNumber.replace(/\D/g, "");

    if (!cleanedNumber) {
      newErrors.phone = "Phone number is required";
    } else if (cleanedNumber.length < 10) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateOtp = (): boolean => {
    const newErrors: FormErrors = {};
    const otpString = otp.join("");

    if (otpString.length !== 6) {
      newErrors.otp = "Please enter the complete 6-digit code";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOtp = async () => {
    if (!validatePhone()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\D/g, "")}`;
      const phoneProvider = new firebase.auth.PhoneAuthProvider();

      const verificationId = await phoneProvider.verifyPhoneNumber(
        fullPhoneNumber,
        recaptchaVerifier.current!
      );

      setVerificationId(verificationId);
      setStep("otp");
      Alert.alert("Success", "OTP sent successfully!");
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      let errorMessage = "Failed to send OTP. Please try again.";

      if (error.code === "auth/invalid-phone-number") {
        errorMessage = "Invalid phone number format";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later.";
      } else if (error.code === "auth/billing-not-enabled") {
        errorMessage =
          "Phone auth requires Firebase Blaze plan. Please upgrade your Firebase project.";
      }

      setErrors({ phone: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!validateOtp() || !verificationId) return;

    setIsLoading(true);
    setErrors({});

    try {
      const otpString = otp.join("");
      const credential = firebase.auth.PhoneAuthProvider.credential(
        verificationId,
        otpString
      );

      await auth.signInWithCredential(credential);

      Alert.alert("Success", "Phone number verified successfully!");
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      let errorMessage = "Invalid OTP. Please try again.";

      if (error.code === "auth/invalid-verification-code") {
        errorMessage = "Invalid verification code";
      } else if (error.code === "auth/code-expired") {
        errorMessage = "OTP has expired. Please request a new one.";
      }

      setErrors({ otp: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const pastedCode = value.slice(0, 6).split("");
      const newOtp = [...otp];
      pastedCode.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit;
      });
      setOtp(newOtp);
      otpInputRefs.current[5]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (errors.otp) setErrors({ ...errors, otp: undefined });

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    setOtp(["", "", "", "", "", ""]);
    await handleSendOtp();
  };

  const handleChangeNumber = () => {
    setStep("phone");
    setOtp(["", "", "", "", "", ""]);
    setVerificationId(null);
    setErrors({});
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>
            {step === "phone" ? "Welcome" : "Verify OTP"}
          </Text>
          <Text style={styles.subtitle}>
            {step === "phone"
              ? "Enter your phone number to continue"
              : `Enter the 6-digit code sent to ${countryCode} ${phoneNumber}`}
          </Text>
        </View>

        {/* Form Section */}
        <View style={styles.formContainer}>
          {step === "phone" ? (
            <>
              {/* Phone Number Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.phoneInputContainer}>
                  <TouchableOpacity style={styles.countryCodeButton}>
                    <Text style={styles.countryCodeText}>{countryCode}</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[
                      styles.phoneInput,
                      errors.phone && styles.inputError,
                    ]}
                    placeholder="Enter phone number"
                    placeholderTextColor={Colors.light.icon}
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={(text) => {
                      setPhoneNumber(text);
                      if (errors.phone)
                        setErrors({ ...errors, phone: undefined });
                    }}
                    editable={!isLoading}
                    maxLength={15}
                  />
                </View>
                {errors.phone && (
                  <Text style={styles.errorText}>{errors.phone}</Text>
                )}
              </View>

              {/* Send OTP Button */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleSendOtp}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* OTP Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <View style={styles.otpContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => {
                        otpInputRefs.current[index] = ref;
                      }}
                      style={[
                        styles.otpInput,
                        digit && styles.otpInputFilled,
                        errors.otp && styles.inputError,
                      ]}
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, index)}
                      onKeyPress={({ nativeEvent }) =>
                        handleOtpKeyPress(nativeEvent.key, index)
                      }
                      keyboardType="number-pad"
                      maxLength={1}
                      editable={!isLoading}
                      selectTextOnFocus
                    />
                  ))}
                </View>
                {errors.otp && (
                  <Text style={styles.errorText}>{errors.otp}</Text>
                )}
              </View>

              {/* Verify OTP Button */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleVerifyOtp}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify OTP</Text>
                )}
              </TouchableOpacity>

              {/* Resend & Change Number */}
              <View style={styles.otpActionsContainer}>
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={isLoading}
                >
                  <Text style={styles.linkText}>Resend OTP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleChangeNumber}
                  disabled={isLoading}
                >
                  <Text style={styles.linkText}>Change Number</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Footer Section */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>By continuing, you agree to our</Text>
          <View style={styles.footerLinksContainer}>
            <TouchableOpacity>
              <Text style={styles.footerLinkText}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.footerText}> & </Text>
            <TouchableOpacity>
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContainer: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.icon,
    lineHeight: 24,
  },
  formContainer: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 8,
  },
  phoneInputContainer: {
    flexDirection: "row",
    gap: 12,
  },
  countryCodeButton: {
    height: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: "#F9FAFB",
  },
  inputError: {
    borderColor: "#EF4444",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 8,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    color: Colors.light.text,
    backgroundColor: "#F9FAFB",
  },
  otpInputFilled: {
    borderColor: Colors.light.tint,
    backgroundColor: "#F0F9FF",
  },
  primaryButton: {
    height: 52,
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  otpActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.tint,
  },
  footerContainer: {
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: Colors.light.icon,
  },
  footerLinksContainer: {
    flexDirection: "row",
    marginTop: 4,
  },
  footerLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.tint,
  },
});
