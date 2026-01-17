import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { auth } from "../../config/firebase";

export default function Profile() {
  const [phone, setPhone] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const fetchContacts = useCallback(
    async (uid: string) => {
      const res = await fetch(`${API_URL}/user/${uid}`);
      const data = await res.json();
      setContacts(data?.emergencyContacts || []);
    },
    [API_URL]
  );

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setPhone(user.phoneNumber);
      fetchContacts(user.uid);
    }
  }, [fetchContacts]);

  const saveContact = async () => {
    if (!name || !emergencyPhone) {
      Alert.alert("Enter name and number");
      return;
    }

    const user = auth.currentUser;

    await fetch(`${API_URL}/user/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user?.uid,
        phone: user?.phoneNumber,
        name,
        emergencyPhone,
      }),
    });

    setName("");
    setEmergencyPhone("");
    fetchContacts(user!.uid);

    Alert.alert("Saved", "Emergency contact added ✅");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? 80 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 30,
          paddingBottom: 450,
          backgroundColor: "#f9f9f9",
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: "bold" }}>Profile 👤</Text>

        <Text style={{ marginTop: 10 }}>Your Phone:</Text>
        <Text style={{ fontWeight: "600" }}>{phone}</Text>

        <Text style={{ marginTop: 20, fontSize: 18, fontWeight: "600" }}>
          Emergency Contacts
        </Text>

        {contacts.map((item, i) => (
          <View
            key={i}
            style={{
              backgroundColor: "#e3f2fd",
              padding: 12,
              borderRadius: 8,
              marginTop: 10,
            }}
          >
            <Text style={{ fontWeight: "600" }}>{item.name}</Text>
            <Text>{item.phone}</Text>
          </View>
        ))}

        <Text style={{ marginTop: 25, fontWeight: "600" }}>
          Add New Emergency Contact
        </Text>

        <TextInput
          placeholder="Name"
          value={name}
          onChangeText={setName}
          style={{
            borderWidth: 1,
            padding: 12,
            borderRadius: 8,
            marginTop: 10,
            backgroundColor: "#fff",
          }}
        />

        <TextInput
          placeholder="+91XXXXXXXXXX"
          value={emergencyPhone}
          onChangeText={setEmergencyPhone}
          keyboardType="phone-pad"
          style={{
            borderWidth: 1,
            padding: 12,
            borderRadius: 8,
            marginTop: 10,
            backgroundColor: "#fff",
          }}
        />

        <TouchableOpacity
          onPress={saveContact}
          style={{
            backgroundColor: "#1976d2",
            padding: 14,
            borderRadius: 10,
            alignItems: "center",
            marginTop: 15,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Save Contact</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
