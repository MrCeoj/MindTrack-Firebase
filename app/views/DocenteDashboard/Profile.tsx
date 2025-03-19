import { View, Text, Pressable, Image, TextInput } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import { getAuth, signOut } from "firebase/auth";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
const icon = require("@/assets/images/icon.png");

interface ProfileProps {
  // props
  nombre: string;
  apellidos: string;
  email: string;
  matricula: string;
}

export default function Profile() {
  const auth = getAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<ProfileProps>({
    nombre: '',
    apellidos: '',
    email: '',
    matricula: ''
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) {
        router.replace("/");
        return;
      }
      const db = getFirestore();
      const userDoc = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
      if (!userDoc.exists()) {
        router.replace("/");
        return;
      }

      const profileData: ProfileProps = {
        nombre: userDoc.data().nombre,
        apellidos: userDoc.data().apellidos,
        email: userDoc.data().email,
        matricula: userDoc.data().matricula
      };

      setUserData(profileData);
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View className="flex-1 items-center justify-center">
      <View className="absolute top-5 right-5 items-center justify-center flex flex-col w-22 z-50 bg-wine-dark p-2 rounded-lg">
        <Pressable onPress={handleLogout}>
          <FontAwesome6
            name="person-walking-dashed-line-arrow-right"
            size={24}
            color="white"
            alt="Cerrar sesión"
          />
        </Pressable>
      </View>

      <Text className="text-4xl font-bold">Perfil</Text>
      <Image source={icon} className="w-40 h-40 mb-5" />
      <View className="w-5/6">
        <Text className="text-lg font-bold">Nombre del docente</Text>
        <TextInput
          className="w-full h-12 bg-slate-300 border-slate-600 border-2 rounded-md pl-4"
          editable={false}
          selectTextOnFocus={false}
          value={userData.nombre+" "+userData.apellidos}
        />
        <Text className="text-lg font-bold mt-3">Correo electrónico</Text>
        <TextInput
          className="w-full h-12 bg-slate-300 border-slate-600 border-2 rounded-md pl-4"
          editable={false}
          selectTextOnFocus={false}
          value={userData.email}
        />
        <Text className="text-lg font-bold mt-3">Número de empleado</Text>
        <TextInput
          className="w-full h-12 bg-slate-300 border-slate-600 border-2 rounded-md pl-4"
          editable={false}
          selectTextOnFocus={false}
          value={userData.matricula}
        />
      </View>
    </View>
  );
}
