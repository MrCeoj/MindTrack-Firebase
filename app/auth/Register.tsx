import { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  Image, 
  TextInput, 
  Pressable, 
  Alert, 
  ScrollView,
  Switch,
  ActivityIndicator
} from "react-native";
import { Picker } from '@react-native-picker/picker';
import { Link, router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDocs } from "firebase/firestore";
import { auth } from "../../FirebaseConfig";

const Welcome = require("@/assets/images/icon.png");

function Register() {
  // Estados para los campos comunes
  const [email, setEmail] = useState("");
  const [matricula, setMatricula] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [contacto, setContacto] = useState("");
  const [curp, setCurp] = useState("");

  // Estados para el tipo de usuario
  const [isDocente, setIsDocente] = useState(false);
  
  // Estados específicos para alumno
  const [tutorNombre, setTutorNombre] = useState("");
  const [semestre, setSemestre] = useState("2");
  const [carrera, setCarrera] = useState("");
  const [carreras, setCarreras] = useState<{ id: string; nombre: string }[]>([]);

  // Estados específicos para docente
  const [rfc, setRfc] = useState("");

  // Estado para el proceso de carga
  const [loading, setLoading] = useState(false);
  const [loadingCarreras, setLoadingCarreras] = useState(true);

  // Inicializar Firestore
  const db = getFirestore();

  // Cargar las carreras al iniciar
  useEffect(() => {
    const fetchCarreras = async () => {
      try {
        const carrerasCollection = collection(db, "carreras");
        const carrerasSnapshot = await getDocs(carrerasCollection);
        const carrerasList = carrerasSnapshot.docs.map(doc => ({
          id: doc.id,
          nombre: doc.data().nombre
        }));
        
        setCarreras(carrerasList);
        
        // Seleccionar la primera carrera por defecto
        if (carrerasList.length > 0) {
          setCarrera(carrerasList[0].id);
        }
      } catch (error) {
        console.error("Error al cargar las carreras:", error);
        Alert.alert("Error", "No se pudieron cargar las carreras");
      } finally {
        setLoadingCarreras(false);
      }
    };

    fetchCarreras();
  }, []);

  const handleRegister = async () => {
    // Validación básica
    if (!email || !matricula || !nombre || !apellidos || !contacto || !curp) {
      Alert.alert("Error", "Por favor completa todos los campos obligatorios");
      return;
    }

    // Validaciones específicas según el tipo de usuario
    if (!isDocente && (!tutorNombre || !carrera)) {
      Alert.alert("Error", "Por favor completa todos los campos para estudiante");
      return;
    }

    if (isDocente && !rfc) {
      Alert.alert("Error", "Por favor ingresa el RFC");
      return;
    }

    try {
      setLoading(true);
      
      // Crear usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, matricula);
      const user = userCredential.user;
      
      // Agregar datos a Firestore
      const userData = {
        email,
        matricula,
        nombre,
        apellidos,
        contacto,
        curp,
        rol: isDocente ? "docente" : "alumno",
        fechaCreacion: new Date()
      };
      
      // Guardar en colección de usuarios
      await setDoc(doc(db, "usuarios", user.uid), userData);
      
      // Guardar datos específicos según el tipo de usuario
      if (isDocente) {
        await setDoc(doc(db, "docentes", user.uid), {
          rfc
        });
      } else {
        await setDoc(doc(db, "alumnos", user.uid), {
          tutor: {
            nombre: tutorNombre,
            contacto: contacto // Mismo contacto que el alumno por defecto, se puede cambiar
          },
          carrera,
          semestre: parseInt(semestre),
          datosClinicos: {
            enfermedades: [],
            alergias: [],
            medicaciones: [],
            discapacidades: []
          }
        });
      }
      
      Alert.alert(
        "Registro exitoso", 
        `Te has registrado correctamente como ${isDocente ? "docente" : "alumno"}`,
        [
          { 
            text: "OK", 
            onPress: () => router.replace("/") // Redirigir al login
          }
        ]
      );
      
    } catch (error) {
      console.error("Error al registrar:", error);
      let errorMessage = "Error al registrar el usuario.";
      
      if ((error as any).code === 'auth/email-already-in-use') {
        errorMessage = "Este correo ya está registrado.";
      } else if ((error as any).code === 'auth/invalid-email') {
        errorMessage = "El formato del correo electrónico no es válido.";
      } else if ((error as any).code === 'auth/weak-password') {
        errorMessage = "La contraseña debe tener al menos 6 caracteres.";
      }
      
      Alert.alert("Error de registro", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex flex-col flex-1 justify-center items-center bg-wine-dark py-8">
        <View className="flex flex-row justify-center">
          <Image source={Welcome} className="w-40 h-40 mt-10" />
        </View>
        
        <Text className="text-white text-2xl font-bold mt-2 mb-6">Registro de Usuario</Text>
        
        {/* Selector de tipo de usuario */}
        <View className="flex flex-row items-center w-96 justify-between mb-4">
          <Text className="text-white text-lg">Soy docente:</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#FF0066" }}
            thumbColor={isDocente ? "#ffffff" : "#f4f3f4"}
            onValueChange={() => setIsDocente(previousState => !previousState)}
            value={isDocente}
          />
        </View>
        
        {/* Campos comunes */}
        <TextInput
          className="bg-white w-96 h-12 rounded-md mt-2 pl-4"
          placeholder="Nombre"
          placeholderTextColor={"#2F031A"}
          textAlignVertical="center"
          value={nombre}
          onChangeText={setNombre}
        />
        
        <TextInput
          className="bg-white w-96 h-12 rounded-md mt-2 pl-4"
          placeholder="Apellidos"
          placeholderTextColor={"#2F031A"}
          textAlignVertical="center"
          value={apellidos}
          onChangeText={setApellidos}
        />
        
        <TextInput
          className="bg-white w-96 h-12 rounded-md mt-2 pl-4"
          placeholder="Correo electrónico"
          keyboardType="email-address"
          placeholderTextColor={"#2F031A"}
          textAlignVertical="center"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        
        <TextInput
          className="bg-white w-96 h-12 rounded-md mt-2 pl-4"
          placeholder="Matrícula (será tu contraseña)"
          keyboardType="numeric"
          placeholderTextColor={"#2F031A"}
          textAlignVertical="center"
          value={matricula}
          onChangeText={setMatricula}
          secureTextEntry={false}
        />
        
        <TextInput
          className="bg-white w-96 h-12 rounded-md mt-2 pl-4"
          placeholder="Contacto (teléfono)"
          keyboardType="phone-pad"
          placeholderTextColor={"#2F031A"}
          textAlignVertical="center"
          value={contacto}
          onChangeText={setContacto}
        />
        
        <TextInput
          className="bg-white w-96 h-12 rounded-md mt-2 pl-4"
          placeholder="CURP"
          placeholderTextColor={"#2F031A"}
          textAlignVertical="center"
          value={curp}
          onChangeText={setCurp}
          autoCapitalize="characters"
          maxLength={18}
        />
        
        {/* Campos específicos según tipo de usuario */}
        {isDocente ? (
          <TextInput
            className="bg-white w-96 h-12 rounded-md mt-2 pl-4"
            placeholder="RFC"
            placeholderTextColor={"#2F031A"}
            textAlignVertical="center"
            value={rfc}
            onChangeText={setRfc}
            autoCapitalize="characters"
            maxLength={13}
          />
        ) : (
          <>
            <TextInput
              className="bg-white w-96 h-12 rounded-md mt-2 pl-4"
              placeholder="Nombre del tutor"
              placeholderTextColor={"#2F031A"}
              textAlignVertical="center"
              value={tutorNombre}
              onChangeText={setTutorNombre}
            />
            
            <View className="bg-white w-96 h-12 rounded-md mt-2 pl-4 justify-center">
              <Picker
                selectedValue={semestre}
                onValueChange={(itemValue) => setSemestre(itemValue)}
                style={{ color: "#2F031A" }}
                dropdownIconColor="#2F031A"
              >
                {[2, 4, 6].map((num) => (
                  <Picker.Item key={num} label={`Semestre ${num}`} value={`${num}`} />
                ))}
              </Picker>
            </View>
            
            {loadingCarreras ? (
              <View className="bg-white w-96 h-12 rounded-md mt-2 justify-center items-center">
                <ActivityIndicator color="#2F031A" />
              </View>
            ) : (
              <View className="bg-white w-96 h-12 rounded-md mt-2 pl-4 justify-center">
                <Picker
                  selectedValue={carrera}
                  onValueChange={(itemValue) => setCarrera(itemValue)}
                  style={{ color: "#2F031A" }}
                  dropdownIconColor="#2F031A"
                >
                  {carreras.map((item) => (
                    <Picker.Item key={item.id} label={item.nombre} value={item.id} />
                  ))}
                </Picker>
              </View>
            )}
          </>
        )}
        
        <Pressable 
          className={`${loading ? "bg-gray-400" : "bg-pink-button"} w-96 mt-6 h-12 rounded-lg items-center justify-center`}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text className="text-white font-semibold text-lg">
            {loading ? "Registrando..." : "Registrarme"}
          </Text>
        </Pressable>
        
        <Link className="mt-4 text-white font-bold text-lg" href={"/"}>
          ¿Ya tienes cuenta? Inicia sesión
        </Link>
      </View>
    </ScrollView>
  );
}

export default Register;