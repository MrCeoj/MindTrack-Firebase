import { useState } from "react";
import { View, Text, Image, TextInput, Pressable, Alert } from "react-native";
import { Link, router } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { auth } from "../../FirebaseConfig";

const Welcome = require("@/assets/images/welcome.png");

function Login() {
  const [email, setEmail] = useState("");
  const [matricula, setMatricula] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !matricula) {
      Alert.alert("Error", "Por favor ingresa tu correo y matrícula");
      return;
    }

    try {
      setLoading(true);
      // Autenticación con Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, matricula);
      const user = userCredential.user;
      
      // Obtener el rol del usuario desde Firestore
      const db = getFirestore();
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const rol = userData.rol;
        
        // Redireccionar según el rol
        if (rol === "docente") {
          router.replace("../views/DocenteDashboard/(Groups)");
        } else {
          router.replace("../views/AlumnoDashboard/Groups");
        }
      } else {
        // Si el usuario existe en Authentication pero no en Firestore
        Alert.alert("Error", "Información de usuario incompleta. Por favor contacta al administrador.");
        await signOut(auth); // Cerrar sesión porque los datos están incompletos
      }
      
    } catch (error) {
      console.error("Error de autenticación:", error);
      let errorMessage = "Error al iniciar sesión. Por favor verifica tus credenciales.";
      if ((error as any).code === 'auth/user-not-found') {
        errorMessage = "No existe una cuenta con este correo electrónico.";
      } else if ((error as any).code === 'auth/wrong-password') {
        errorMessage = "La matrícula es incorrecta.";
      } else if ((error as any).code === 'auth/invalid-email') {
        errorMessage = "El formato del correo electrónico no es válido.";
      }
      Alert.alert("Error de autenticación", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="h-full flex flex-col flex-1 justify-center items-center bg-wine-dark">
      <View className="flex flex-row justify-center">
        <Image source={Welcome} className="w-80 h-60" />
      </View>
      <TextInput
        className="bg-white w-96 h-12 rounded-md mt-4 pl-4 text-xl"
        placeholder="Ingrese su correo"
        keyboardType="email-address"
        placeholderTextColor={"#2F031A"}
        textAlignVertical="center"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        className="bg-white w-96 h-12 rounded-md mt-3 pl-4 text-xl"
        placeholder="Ingresa tu matricula"
        keyboardType="numeric"
        placeholderTextColor={"#2F031A"}
        textAlignVertical="center"
        value={matricula}
        onChangeText={setMatricula}
      />
      <Pressable 
        className={`${loading ? "bg-gray-400" : "bg-pink-button"} w-96 mt-6 h-12 rounded-lg items-center justify-center`}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text className="text-white font-semibold text-lg">
          {loading ? "Cargando..." : "Iniciar sesión"}
        </Text>
      </Pressable>
      <Link className="mt-6 text-white font-bold text-lg" href={"./Register"}>
        ¿Sin cuenta? Regístrate
      </Link>
    </View>
  );
}

export default Login;