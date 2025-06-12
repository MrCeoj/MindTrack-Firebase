import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
  Linking,
  Platform,
  Modal,
} from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import { getAuth, signOut } from "firebase/auth";
import { useRouter } from "expo-router";
import { VictoryPie, VictoryTheme, VictoryLegend } from "victory-native";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { storage } from "../../FirebaseConfig";
import ReactNativeBlobUtil from "react-native-blob-util";

interface File {
  name?: string;
  uri: string;
  type?: string;
}

interface FormatearFechaParams {
  fechaIso: string;
}

interface AlertButton {
  text: string;
  onPress: () => void;
  style?: "cancel" | "default" | "destructive";
}

interface DocumentoMedico {
  nombre: string;
  fileName: string;
  url: string;
  path: string;
  fechaSubida: string;
  subidoPor: string;
}

interface ProcesarSubidaParams {
  file: File;
  nombreDocumento: string;
}

interface AbrirDocumentoParams {
  url: string;
}

export default function Profile() {
  const auth = getAuth();
  const router = useRouter();

  const [cargando, setCargando] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [userId, setUserId] = useState("");
  const [estadoHoy, setEstadoHoy] = useState<
    "bueno" | "regular" | "malo" | null
  >(null); // null, 'bueno', 'regular', 'malo'
  const [datosEmocionales, setDatosEmocionales] = useState({
    bueno: 0,
    regular: 0,
    malo: 0,
  });
  const [error, setError] = useState("");
  const [datosGrafico, setDatosGrafico] = useState<
    { x: "bueno" | "regular" | "malo"; y: number; label: string }[]
  >([]);
  const [hayDatosEmocionales, setHayDatosEmocionales] = useState(false);

  const [documentos, setDocumentos] = useState<DocumentoMedico[]>([]);

  const [guardando, setGuardando] = useState(false);

  // Estado para los datos clínicos
  const [datosClinicos, setDatosClinicos] = useState<DatosClinicos>({
    alergias: [],
    enfermedades: [],
    medicaciones: [],
    discapacidades: [],
  });

  // Estado para los campos de texto
  const [nuevaAlergia, setNuevaAlergia] = useState("");
  const [nuevaEnfermedad, setNuevaEnfermedad] = useState("");
  const [nuevaMedicacion, setNuevaMedicacion] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  // Lista predefinida de discapacidades
  const discapacidadesOpciones = [
    "Discapacidad visual",
    "Discapacidad del habla",
    "Discapacidad motriz",
    "Discapacidad auditiva",
    "TDAH",
    "Asperger",
    "Autismo",
    "Dislexia",
  ];

  // Iconos/emoji para visualizar los estados
  const emojis = {
    bueno: "😃",
    regular: "😐",
    malo: "😔",
  };

  // Colores para los estados emocionales
  const colores = {
    bueno: "#4CAF50", // Verde
    regular: "#FFC107", // Amarillo
    malo: "#F44336", // Rojo
  };

  useEffect(() => {
    if (auth.currentUser) {
      setUserId(auth.currentUser.uid);

      // Obtener datos del usuario
      const db = getFirestore();
      const obtenerDatosUsuario = async () => {
        try {
          setCargando(true);
          if (!auth.currentUser) {
            throw new Error("El usuario no está autenticado");
          }
          const docRef = doc(db, "alumnos", auth.currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        } catch (err) {
          console.error("Error al obtener datos del usuario:", err);
          setError("No se pudieron cargar los datos del usuario");
        } finally {
          setCargando(false);
        }
      };

      obtenerDatosUsuario();
      console.log("Usuario autenticado:", auth.currentUser);
      console.log("Datos del usuario:", userData);
    }
  }, []);

  useEffect(() => {
    const db = getFirestore();
    const obtenerDatosEmocionales = async () => {
      try {
        setCargando(true);

        // Verificar si ya registró su estado emocional hoy
        const fechaHoy = new Date();
        fechaHoy.setHours(0, 0, 0, 0);

        const docRef = doc(
          db,
          "alumnos",
          userId,
          "estadosEmocionales",
          format(fechaHoy, "yyyy-MM-dd")
        );
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setEstadoHoy(docSnap.data().estado);
        }

        // Obtener el resumen de estados emocionales de los últimos 30 días
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 30);

        const estadoQuery = query(
          collection(db, "alumnos", userId, "estadosEmocionales"),
          where("fecha", ">=", Timestamp.fromDate(fechaInicio))
        );

        const estadosSnapshot = await getDocs(estadoQuery);

        const conteo = {
          bueno: 0,
          regular: 0,
          malo: 0,
        };

        estadosSnapshot.forEach((doc) => {
          const estadoData = doc.data() as {
            estado: "bueno" | "regular" | "malo";
          };
          if (estadoData.estado in conteo) {
            conteo[estadoData.estado]++;
          }
        });

        setDatosEmocionales(conteo);
      } catch (err) {
        console.error("Error al obtener estados emocionales:", err);
        setError("No se pudieron cargar los datos emocionales");
      } finally {
        setCargando(false);
      }
    };

    if (userId) {
      obtenerDatosEmocionales();
    }
  }, [userId]);

  useEffect(() => {
    const db = getFirestore();
    const obtenerDatosClinicos = async () => {
      try {
        setCargando(true);
        const alumnoRef = doc(db, "alumnos", userId);
        const alumnoDoc = await getDoc(alumnoRef);

        if (alumnoDoc.exists()) {
          const alumnoData = alumnoDoc.data();
          if (alumnoData.datosClinicos) {
            setDatosClinicos(alumnoData.datosClinicos);
          }
        }
      } catch (err) {
        console.error("Error al obtener datos clínicos:", err);
        setError("No se pudieron cargar los datos clínicos");
      } finally {
        setCargando(false);
      }
    };

    const obtenerDocumentos = async () => {
      try {
        setCargando(true);

        // Referencia al documento del alumno
        const alumnoRef = doc(db, "alumnos", userId);
        const alumnoDoc = await getDoc(alumnoRef);

        if (alumnoDoc.exists()) {
          const alumnoData = alumnoDoc.data();

          // Verifica si existen documentos médicos
          if (
            alumnoData.documentosMedicos &&
            Array.isArray(alumnoData.documentosMedicos)
          ) {
            setDocumentos(alumnoData.documentosMedicos);
          }
        }
      } catch (err) {
        console.error("Error al obtener documentos médicos:", err);
        setError("No se pudieron cargar los documentos médicos");
      } finally {
        setCargando(false);
      }
    };

    if (userId) {
      obtenerDatosClinicos();

      obtenerDocumentos();
    }
  }, [userId]);

  useEffect(() => {
    // Preparar datos para el gráfico de pastel
    const dataChart = Object.keys(datosEmocionales).map((key) => ({
      x: key as "bueno" | "regular" | "malo",
      y: datosEmocionales[key as "bueno" | "regular" | "malo"],
      label: ""
    }));

    // Si no hay datos, mostrar un mensaje apropiado
    const hayDatos = dataChart.some((d) => d.y > 0);

    setHayDatosEmocionales(hayDatos);
    setDatosGrafico(dataChart);
  }, [datosEmocionales]);

  const seleccionarDocumento = async () => {
    try {
      console.debug("Seleccionar documento");
      const resultado = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      console.debug("Resultado de selección de documento:", resultado);

      if (resultado.canceled) {
        return;
      }

      // Si estamos usando la nueva API de expo-document-picker
      const file = resultado.assets ? resultado.assets[0] : resultado;

      console.log("Archivo seleccionado:", file);

      if (file) {
        subirDocumento(file);
      }
    } catch (err) {
      console.error("Error al seleccionar documento:", err);
      Alert.alert("Error", "No se pudo seleccionar el documento");
    }
  };

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const handleCancel = () => {
    setIsModalVisible(false); // Hide the modal
    setSubiendo(false); // Reset the upload state
  };

  const handleSubmit = async (nombreDocumento: string) => {
    try {
      if (!nombreDocumento || nombreDocumento.trim() === "") {
        Alert.alert("Error", "El nombre del documento es obligatorio");
        setSubiendo(false);
        return;
      }

      setIsModalVisible(false); // Hide the modal

      if (fileToUpload) {
        setSubiendo(true); // Set uploading state
        await procesarSubida(fileToUpload, nombreDocumento.trim());
        setFileToUpload(null); // Clear the file from the state
      }
    } catch (err) {
      console.error("Error al subir documento:", err);
      Alert.alert("Error", "No se pudo subir el documento");
    } finally {
      setSubiendo(false); // Reset uploading state
    }
  };

  const subirDocumento = async (file: File) => {
    try {
      setFileToUpload(file); // Save the file to the state
      setIsModalVisible(true); // Show the modal prompt
    } catch (err) {
      console.error("Error al subir documento:", err);
      Alert.alert("Error", "No se pudo subir el documento");
      setSubiendo(false);
    }
  };

  const procesarSubida = async (file: File, nombreDocumento: string) => {
    try {
      const db = getFirestore();
      const fileName = file.name || file.uri.split("/").pop()!;
      const extension = fileName.split(".").pop()!;
      const timestamp = new Date().getTime();
      const storageFileName = `${userId}/${timestamp}_${nombreDocumento}.${extension}`;
      const storageRef = ref(storage, storageFileName);

      console.log("Subiendo archivo:", file);

      // Handle the file upload using uploadBytesResumable
      const blob = await fetch(file.uri).then((res) => res.blob());
      const uploadTask = uploadBytesResumable(storageRef, blob);

      // Track progress
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Progreso de subida: ${progress}%`);
        },
        (error) => {
          console.error("Error durante la subida:", error);
          Alert.alert("Error", "No se pudo completar la subida del documento");
        },
        async () => {
          // Upload complete
          console.log("Archivo subido con éxito:", storageFileName);
          const downloadURL = await getDownloadURL(storageRef);

          const nuevoDocumento: DocumentoMedico = {
            nombre: nombreDocumento,
            fileName: fileName,
            url: downloadURL,
            path: storageFileName,
            fechaSubida: new Date().toISOString(),
            subidoPor: userData.nombre + " " + userData.apellidos || "Usuario",
          };

          console.log("Nuevo documento:", nuevoDocumento);

          const alumnoRef = doc(db, "alumnos", userId);
          await updateDoc(alumnoRef, {
            documentosMedicos: arrayUnion(nuevoDocumento),
          });

          console.log("Documento registrado en la base de datos");
          setDocumentos((prevDocs) => [...prevDocs, nuevoDocumento]);
          Alert.alert("Éxito", "El documento se ha subido correctamente", [
            { text: "OK" },
          ]);
        }
      );
    } catch (err) {
      console.error("Error en la subida:", err);
      Alert.alert("Error", "No se pudo completar la subida del documento");
    } finally {
      setSubiendo(false);
    }
  };

  const abrirDocumento = async ({ url }: AbrirDocumentoParams) => {
    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Error",
          "No se puede abrir este enlace en tu dispositivo",
          [{ text: "OK" }]
        );
      }
    } catch (err) {
      console.error("Error al abrir documento:", err);
      Alert.alert("Error", "No se pudo abrir el documento");
    }
  };

  const formatearFecha = ({ fechaIso }: FormatearFechaParams): string => {
    try {
      const fecha = new Date(fechaIso);
      return format(fecha, "dd 'de' MMMM 'de' yyyy", { locale: es });
    } catch (err) {
      return "Fecha desconocida";
    }
  };

  const guardarDatosClinicos = async () => {
    try {
      const db = getFirestore();
      setGuardando(true);
      const alumnoRef = doc(db, "alumnos", userId);

      await updateDoc(alumnoRef, {
        datosClinicos: datosClinicos,
      });

      Alert.alert(
        "Datos guardados",
        "Los datos clínicos se han guardado correctamente",
        [{ text: "OK" }]
      );
    } catch (err) {
      console.error("Error al guardar datos clínicos:", err);
      setError("No se pudieron guardar los datos clínicos");
      Alert.alert("Error", "No se pudieron guardar los datos clínicos", [
        { text: "OK" },
      ]);
    } finally {
      setGuardando(false);
    }
  };

  // Funciones para manejar los campos de texto libre
  interface DatosClinicos {
    alergias: string[];
    enfermedades: string[];
    medicaciones: string[];
    discapacidades: string[];
  }

  type TipoDatoClinico = "alergias" | "enfermedades" | "medicaciones";

  const agregarItem = (tipo: TipoDatoClinico, valor: string) => {
    if (!valor.trim()) return;

    setDatosClinicos((prev: DatosClinicos) => ({
      ...prev,
      [tipo]: [...prev[tipo], valor.trim()],
    }));

    // Limpiar el campo después de agregar
    switch (tipo) {
      case "alergias":
        setNuevaAlergia("");
        break;
      case "enfermedades":
        setNuevaEnfermedad("");
        break;
      case "medicaciones":
        setNuevaMedicacion("");
        break;
    }
  };

  interface DatosClinicos {
    alergias: string[];
    enfermedades: string[];
    medicaciones: string[];
    discapacidades: string[];
  }

  const eliminarItem = (tipo: TipoDatoClinico, index: number) => {
    setDatosClinicos((prev: DatosClinicos) => ({
      ...prev,
      [tipo]: prev[tipo].filter((_, i) => i !== index),
    }));
  };

  // Función para manejar las discapacidades (toggles)
  interface DatosClinicos {
    alergias: string[];
    enfermedades: string[];
    medicaciones: string[];
    discapacidades: string[];
  }

  const toggleDiscapacidad = (discapacidad: string) => {
    setDatosClinicos((prev: DatosClinicos) => {
      if (prev.discapacidades.includes(discapacidad)) {
        return {
          ...prev,
          discapacidades: prev.discapacidades.filter(
            (item: string) => item !== discapacidad
          ),
        };
      } else {
        return {
          ...prev,
          discapacidades: [...prev.discapacidades, discapacidad],
        };
      }
    });
  };

  if (cargando) {
    return (
      <View className="flex-1 bg-wine-dark p-6 justify-center items-center">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text className="text-white mt-4">Cargando datos clínicos...</Text>
      </View>
    );
  }

  const registrarEstadoEmocional = async (
    estado: "bueno" | "regular" | "malo"
  ) => {
    try {
      const db = getFirestore();
      setCargando(true);

      const fechaHoy = new Date();
      fechaHoy.setHours(0, 0, 0, 0);

      const docRef = doc(
        db,
        "alumnos",
        userId,
        "estadosEmocionales",
        format(fechaHoy, "yyyy-MM-dd")
      );

      await setDoc(docRef, {
        estado: estado,
        fecha: Timestamp.fromDate(fechaHoy),
      });

      // Actualizar el estado local
      setEstadoHoy(estado);

      // Actualizar los conteos para la gráfica
      setDatosEmocionales((prev) => ({
        ...prev,
        [estado]: prev[estado] + (estadoHoy === estado ? 0 : 1),
        ...(estadoHoy ? { [estadoHoy]: prev[estadoHoy] - 1 } : {}),
      }));
    } catch (err) {
      console.error("Error al registrar estado emocional:", err);
      setError("No se pudo registrar tu estado emocional");
    } finally {
      setCargando(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
      Alert.alert("Error", "No se pudo cerrar sesión", [{ text: "OK" }]);
    }
  };

  interface ModalPromptProps {
    visible: boolean;
    onCancel: () => void;
    onSubmit: (nombreDocumento: string) => void;
  }

  const ModalPrompt = ({ visible, onCancel, onSubmit }: ModalPromptProps) => {
    const [nombreDocumento, setNombreDocumento] = useState("");

    const handleSubmit = () => {
      if (!nombreDocumento.trim()) {
        alert("El nombre del documento es obligatorio");
        return;
      }
      onSubmit(nombreDocumento.trim());
      setNombreDocumento(""); // Reset the input after submission
    };

    return (
      <Modal visible={visible} transparent animationType="slide">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="w-4/5 bg-white rounded-lg p-6">
            <Text className="text-lg font-bold mb-4">Nombre del documento</Text>
            <Text className="text-gray-700 mb-3">
              Ingresa un nombre descriptivo para el documento médico
            </Text>
            <TextInput
              className="h-10 border border-gray-300 rounded px-2 mb-4"
              placeholder="Escribe el nombre aquí"
              value={nombreDocumento}
              onChangeText={setNombreDocumento}
            />
            <View className="flex-row justify-between">
              <Pressable
                onPress={onCancel}
                className="bg-gray-300 py-2 px-4 rounded"
              >
                <Text className="text-gray-700">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                className="bg-blue-500 py-2 px-4 rounded"
              >
                <Text className="text-white">Subir</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View>
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

      <ScrollView className="">
        {/* Rastreo emocional */}
        <View className="flex-1 px-6 py-2">
          <View className="bg-white rounded-lg p-4 mb-4">
            <Text className="text-2xl font-bold mb-2">
              Seguimiento Emocional
            </Text>
            <Text className="text-gray-700 mb-4">
              Registra cómo te sientes hoy y visualiza tu estado emocional de
              los últimos 30 días.
            </Text>

            {/* Selector de estado emocional */}
            <View className="mb-6">
              <Text className="text-lg font-semibold mb-2">
                ¿Cómo te sientes hoy?
              </Text>
              <View className="flex-row justify-between">
                {(
                  ["bueno", "regular", "malo"] as Array<
                    "bueno" | "regular" | "malo"
                  >
                ).map((estado) => (
                  <Pressable
                    key={estado}
                    className={`flex-1 items-center p-3 rounded-lg mx-1 ${
                      estadoHoy === estado ? "border-4" : "border"
                    }`}
                    style={{
                      borderColor: colores[estado],
                      backgroundColor:
                        estadoHoy === estado
                          ? `${colores[estado]}22`
                          : "transparent",
                    }}
                    onPress={() => registrarEstadoEmocional(estado)}
                    disabled={cargando}
                  >
                    <Text style={{ fontSize: 28 }}>{emojis[estado]}</Text>
                    <Text className="mt-1 capitalize">{estado}</Text>
                  </Pressable>
                ))}
              </View>
              {estadoHoy && (
                <Text className="text-center mt-3">
                  Tu estado emocional de hoy:{" "}
                  <Text className="font-bold capitalize">{estadoHoy}</Text>
                </Text>
              )}
            </View>

            <View>
              <Text className="text-lg font-semibold mb-2">
                Últimos 30 días
              </Text>
              {cargando ? (
                <ActivityIndicator size="large" color="#841617" />
              ) : error ? (
                <Text className="text-red-500">{error}</Text>
              ) : !hayDatosEmocionales ? (
                <Text className="text-gray-500 text-center py-8">
                  No has registrado estados emocionales en los últimos 30 días.
                </Text>
              ) : (
                <View className="flex-col flex items-center justify-center">
                  <VictoryLegend
                    x={25}
                    style={{
                      title: { fontSize: 20 },
                    }}
                    title="Estados Emocionales"
                    centerTitle
                    orientation="horizontal"
                    gutter={20}
                    colorScale={[colores.bueno, colores.regular, colores.malo]}
                    data={[
                      { name: "Bueno", symbol: { fill: colores.bueno } },
                      { name: "Regular", symbol: { fill: colores.regular } },
                      { name: "Malo", symbol: { fill: colores.malo } },
                    ]}
                    width={300}
                    height={70}
                  />
                  <VictoryPie
                    y0={50}
                    data={datosGrafico}
                    theme={VictoryTheme.material}
                    colorScale={[colores.bueno, colores.regular, colores.malo]}
                    innerRadius={100}
                    labelRadius={120}
                    width={200}
                    height={200}
                    labels={() => null}
                  />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Evidencia médica */}

        <ScrollView className="flex-1">
          <ModalPrompt
            visible={isModalVisible}
            onCancel={handleCancel}
            onSubmit={handleSubmit}
          />
          <View className="p-6">
            <View className="bg-white rounded-lg p-4 mb-4">
              <Text className="text-2xl font-bold mb-4">Evidencia médica</Text>

              {error && <Text className="text-red-500 mb-4">{error}</Text>}

              <Pressable
                className="bg-green-600 w-full h-12 rounded-lg items-center justify-center mb-6"
                onPress={seleccionarDocumento}
                disabled={subiendo}
              >
                {subiendo ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-white font-semibold text-lg">
                    Subir Nuevo Documento
                  </Text>
                )}
              </Pressable>

              <Text className="text-lg font-semibold mb-3">
                Documentos subidos
              </Text>

              {cargando ? (
                <ActivityIndicator size="large" color="#841617" />
              ) : documentos.length === 0 ? (
                <View className="py-4 items-center">
                  <Text className="text-gray-500">
                    No hay documentos médicos subidos
                  </Text>
                </View>
              ) : (
                documentos.map((documento, index) => (
                  <View
                    key={index}
                    className="border border-gray-200 rounded-lg p-3 mb-3"
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <Text className="font-bold text-lg">
                          {documento.nombre}
                        </Text>
                        <Text className="text-gray-600 text-sm">
                          {formatearFecha({ fechaIso: documento.fechaSubida })}
                        </Text>
                      </View>

                      <Pressable
                        className="bg-blue-500 px-4 py-2 rounded-lg"
                        onPress={() => abrirDocumento({ url: documento.url })}
                      >
                        <Text className="text-white font-semibold">Ver</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}

              <Text className="text-sm text-gray-500 mt-4 italic">
                Nota: Los documentos médicos no pueden ser eliminados una vez
                subidos por razones de registro médico.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Condicion médica */}
        <View className="flex-1 px-6">
          <View className="bg-white rounded-lg p-4 mb-4">
            <Text className="text-center text-lg font-semibold">
              Condición Médica
            </Text>
            {error && <Text className="text-red-500 mb-4">{error}</Text>}

            {/* Sección de Alergias */}
            <View className="mb-6">
              <Text className="text-lg font-semibold mb-2">Alergias</Text>
              <View className="flex-row flex-wrap mb-2">
                {datosClinicos.alergias.map((alergia, index) => (
                  <Pressable
                    key={index}
                    className="bg-blue-100 px-3 py-1 rounded-full mr-2 mb-2 flex-row items-center"
                    onPress={() => eliminarItem("alergias", index)}
                  >
                    <Text className="text-blue-800">{alergia}</Text>
                    <Text className="text-blue-800 ml-1 font-bold">×</Text>
                  </Pressable>
                ))}
              </View>
              <View className="flex-row">
                <TextInput
                  className="flex-1 border border-gray-300 rounded-l-lg px-3 py-2"
                  placeholder="Agregar alergia"
                  value={nuevaAlergia}
                  onChangeText={setNuevaAlergia}
                />
                <Pressable
                  className="bg-blue-500 px-4 rounded-r-lg items-center justify-center"
                  onPress={() => agregarItem("alergias", nuevaAlergia)}
                >
                  <Text className="text-white font-semibold">+</Text>
                </Pressable>
              </View>
            </View>

            {/* Sección de Enfermedades */}
            <View className="mb-6">
              <Text className="text-lg font-semibold mb-2">Padecimientos</Text>
              <View className="flex-row flex-wrap mb-2">
                {datosClinicos.enfermedades.map((enfermedad, index) => (
                  <Pressable
                    key={index}
                    className="bg-green-100 px-3 py-1 rounded-full mr-2 mb-2 flex-row items-center"
                    onPress={() => eliminarItem("enfermedades", index)}
                  >
                    <Text className="text-green-800">{enfermedad}</Text>
                    <Text className="text-green-800 ml-1 font-bold">×</Text>
                  </Pressable>
                ))}
              </View>
              <View className="flex-row">
                <TextInput
                  className="flex-1 border border-gray-300 rounded-l-lg px-3 py-2"
                  placeholder="Agregar padecimiento"
                  value={nuevaEnfermedad}
                  onChangeText={setNuevaEnfermedad}
                />
                <Pressable
                  className="bg-green-500 px-4 rounded-r-lg items-center justify-center"
                  onPress={() => agregarItem("enfermedades", nuevaEnfermedad)}
                >
                  <Text className="text-white font-semibold">+</Text>
                </Pressable>
              </View>
            </View>

            {/* Sección de Medicaciones */}
            <View className="mb-6">
              <Text className="text-lg font-semibold mb-2">Medicaciones</Text>
              <View className="flex-row flex-wrap mb-2">
                {datosClinicos.medicaciones.map((medicacion, index) => (
                  <Pressable
                    key={index}
                    className="bg-purple-100 px-3 py-1 rounded-full mr-2 mb-2 flex-row items-center"
                    onPress={() => eliminarItem("medicaciones", index)}
                  >
                    <Text className="text-purple-800">{medicacion}</Text>
                    <Text className="text-purple-800 ml-1 font-bold">×</Text>
                  </Pressable>
                ))}
              </View>
              <View className="flex-row">
                <TextInput
                  className="flex-1 border border-gray-300 rounded-l-lg px-3 py-2"
                  placeholder="Agregar medicación"
                  value={nuevaMedicacion}
                  onChangeText={setNuevaMedicacion}
                />
                <Pressable
                  className="bg-purple-500 px-4 rounded-r-lg items-center justify-center"
                  onPress={() => agregarItem("medicaciones", nuevaMedicacion)}
                >
                  <Text className="text-white font-semibold">+</Text>
                </Pressable>
              </View>
            </View>

            {/* Sección de Discapacidades */}
            <View className="mb-6">
              <Text className="text-lg font-semibold mb-2">
                Condiciones especiales
              </Text>
              <View className="mb-2">
                {discapacidadesOpciones.map((discapacidad, index) => (
                  <Pressable
                    key={index}
                    className={`flex-row items-center p-3 mb-2 rounded-lg border ${
                      datosClinicos.discapacidades.includes(discapacidad)
                        ? "bg-amber-100 border-amber-500"
                        : "border-gray-300"
                    }`}
                    onPress={() => toggleDiscapacidad(discapacidad)}
                  >
                    <View
                      className={`w-6 h-6 rounded-md mr-3 border ${
                        datosClinicos.discapacidades.includes(discapacidad)
                          ? "bg-amber-500 border-amber-600"
                          : "border-gray-400"
                      } items-center justify-center`}
                    >
                      {datosClinicos.discapacidades.includes(discapacidad) && (
                        <Text className="text-white font-bold">✓</Text>
                      )}
                    </View>
                    <Text
                      className={`${
                        datosClinicos.discapacidades.includes(discapacidad)
                          ? "font-semibold"
                          : ""
                      }`}
                    >
                      {discapacidad}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Botón Guardar */}
            <Pressable
              className="bg-pink-button w-full h-12 rounded-lg items-center justify-center"
              onPress={guardarDatosClinicos}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-white font-semibold text-lg">
                  Guardar Datos Clínicos
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
