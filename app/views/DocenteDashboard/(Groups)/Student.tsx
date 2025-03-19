import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  Linking,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import { FontAwesome6, Foundation } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";
import { useLocalSearchParams } from "expo-router";
import { VictoryPie, VictoryTheme, VictoryLegend } from "victory-native";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { format, set } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState } from "react";

interface File {
  name?: string;
  uri: string;
  type?: string;
}

interface FormatearFechaParams {
  fechaIso: string;
}

interface DocumentoMedico {
  nombre: string;
  fileName: string;
  url: string;
  path: string;
  fechaSubida: string;
  subidoPor: string;
}

interface AbrirDocumentoParams {
  url: string;
}

interface GetAvgParams {
  calif1: number;
  calif2: number;
  calif3: number;
}

export default function Student() {
  const auth = getAuth();
  const { califs } = useLocalSearchParams();
  const studentData = typeof califs === "string" ? JSON.parse(califs) : null;
  const [cargando, setCargando] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [userId, setUserId] = useState("");
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

  // State to track if we're currently editing a grade
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [gradeValue, setGradeValue] = useState({
    parcial1: 0,
    parcial2: 0,
    parcial3: 0,
  });
  const [newGradeValue, setNewGradeValue] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Estado para los datos clínicos
  const [datosClinicos, setDatosClinicos] = useState<DatosClinicos>({
    alergias: [],
    enfermedades: [],
    medicaciones: [],
    discapacidades: [],
  });

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

  const fetchCalifs = async () => {
    try {
      setCargando(true);
      const db = getFirestore();
      const calificacionesRef = collection(db, "calificaciones");
      const querySnapshot = await getDocs(calificacionesRef);
      const califsData = querySnapshot.docs.map((doc) => doc.data());
      console.log("Calificaciones:", califsData);
      setCargando(false);

      // Find the specific calificaciones document for the student
      const studentCalif = califsData.find(
        (calif) =>
          calif.alumnoId === studentData[0].alumnoId &&
          calif.grupoId === studentData[0].grupoId &&
          calif.materiaId === studentData[0].materiaId
      );

      if (!studentCalif) {
        throw new Error("No se encontraron calificaciones para el alumno");
      }

      setGradeValue({
        parcial1: studentCalif.parcial1 || 0,
        parcial2: studentCalif.parcial2 || 0,
        parcial3: studentCalif.parcial3 || 0,
      });

      console.log("Calificaciones del estudiante:", gradeValue);
    } catch (error) {
      console.error("Error al obtener calificaciones:", error);
      setError("No se pudieron cargar las calificaciones");
      setCargando(false);
    }
  };

  useEffect(() => {
    if (studentData) {
      setUserId(studentData[0].alumnoId);
      console.log("Datos del estudiante:", studentData);

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

    fetchCalifs();
  }, [userId]);

  useEffect(() => {
    // Preparar datos para el gráfico de pastel
    const dataChart = Object.keys(datosEmocionales).map((key) => ({
      x: key as "bueno" | "regular" | "malo",
      y: datosEmocionales[key as "bueno" | "regular" | "malo"],
      label:
        datosEmocionales[key as "bueno" | "regular" | "malo"] > 0
          ? `${key}: ${datosEmocionales[key as "bueno" | "regular" | "malo"]}`
          : "",
    }));

    // Si no hay datos, mostrar un mensaje apropiado
    const hayDatos = dataChart.some((d) => d.y > 0);

    setHayDatosEmocionales(hayDatos);
    setDatosGrafico(dataChart);
  }, [datosEmocionales]);

  const formatearFecha = ({ fechaIso }: FormatearFechaParams): string => {
    try {
      const fecha = new Date(fechaIso);
      return format(fecha, "dd 'de' MMMM 'de' yyyy", { locale: es });
    } catch (err) {
      return "Fecha desconocida";
    }
  };

  // Funciones para manejar los campos de texto libre
  interface DatosClinicos {
    alergias: string[];
    enfermedades: string[];
    medicaciones: string[];
    discapacidades: string[];
  }

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

  function getAvg({ calif1, calif2, calif3 }: GetAvgParams): number {
    const count = [calif1, calif2, calif3].filter(
      (calif) => calif !== 0
    ).length;

    if (count === 0) {
      return 0;
    }

    return (calif1 + calif2 + calif3) / count;
  }

  interface DatosClinicos {
    alergias: string[];
    enfermedades: string[];
    medicaciones: string[];
    discapacidades: string[];
  }

  // Función para manejar las discapacidades
  interface DatosClinicos {
    alergias: string[];
    enfermedades: string[];
    medicaciones: string[];
    discapacidades: string[];
  }

  if (cargando) {
    return <></>;
  }

  const editGrade = (gradeType: string, currentValue: number) => {
    setEditingGrade(gradeType);
    setNewGradeValue(currentValue.toString());
    console.log("Editing grade:", gradeType);
  };

  // Function to save the updated grade
  const saveGrade = async () => {
    if (!editingGrade || !studentData || !studentData[0]) return;

    try {
      setIsUpdating(true);
      const db = getFirestore();

      // Find the document ID by querying for the specific calificaciones document
      const calificacionesQuery = query(
        collection(db, "calificaciones"),
        where("alumnoId", "==", studentData[0].alumnoId),
        where("grupoId", "==", studentData[0].grupoId),
        where("materiaId", "==", studentData[0].materiaId)
      );

      const querySnapshot = await getDocs(calificacionesQuery);

      if (querySnapshot.empty) {
        throw new Error("No se encontró el documento de calificaciones");
      }

      const docId = querySnapshot.docs[0].id;
      const docRef = doc(db, "calificaciones", docId);

      // Parse the new grade value as a number
      const grade = parseFloat(newGradeValue);

      // Validate the grade (0-10 range)
      if (isNaN(grade) || grade < 0 || grade > 10) {
        Alert.alert("Error", "La calificación debe ser un número entre 0 y 10");
        return;
      }

      await setDoc(docRef, { [editingGrade]: grade }, { merge: true });

      const updatedStudentData = [...studentData];
      updatedStudentData[0] = {
        ...updatedStudentData[0],
        [editingGrade]: grade,
      };

      Alert.alert("Éxito", "La calificación ha sido actualizada");
      fetchCalifs();
      setEditingGrade(null);
    } catch (error) {
      console.error("Error al actualizar calificación:", error);
      Alert.alert("Error", "No se pudo actualizar la calificación");
    } finally {
      setIsUpdating(false);
    }
  };

  const renderEditGradeModal = () => {
    if (!editingGrade) return null;

    const gradeLabels: Record<string, string> = {
      parcial1: "Parcial 1",
      parcial2: "Parcial 2",
      parcial3: "Parcial 3",
    };

    return (
      <View className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
        <View className="bg-white p-6 rounded-lg w-4/5 max-w-md">
          <Text className="text-xl font-bold mb-4">
            Editar {gradeLabels[editingGrade]}
          </Text>

          <TextInput
            className="border border-gray-300 rounded-md px-4 py-2 mb-4"
            keyboardType="numeric"
            value={newGradeValue}
            onChangeText={setNewGradeValue}
            placeholder="Ingresa la calificación (0-10)"
            maxLength={4} // Allow for decimal values like "9.5"
          />

          <View className="flex-row justify-end space-x-2">
            <Pressable
              className="bg-gray-200 px-4 py-2 rounded-md"
              onPress={() => setEditingGrade(null)}
            >
              <Text>Cancelar</Text>
            </Pressable>

            <Pressable
              className="bg-blue-500 px-4 py-2 rounded-md"
              onPress={saveGrade}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-white">Guardar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View>
      <ScrollView className="">
        {/* Calificaciones */}
        <View className="px-6 py-2">
          <View className="bg-white rounded-lg p-4 mb-4">
            <Text className="text-2xl font-bold mb-2">Calificaciones</Text>
            <View className="flex-row items-center justify-between">
              {/* Parcial 1 */}
              <View>
                <Text className="text-yellow-700 text-lg font-semibold">
                  Parcial 1
                </Text>
                <View className="flex-row items-center">
                  <Text className="text-yellow-700 text-lg font-semibold text-center mr-1">
                    {gradeValue.parcial1 || 0}
                  </Text>
                  <Pressable
                    onPress={() =>
                      editGrade("parcial1", gradeValue.parcial1 || 0)
                    }
                    className="bg-yellow-100 rounded-full p-1"
                  >
                    <FontAwesome6 name="pen" size={12} color="#b45309" />
                  </Pressable>
                </View>
              </View>

              {/* Parcial 2 */}
              <View>
                <Text className="text-red-700 text-lg font-semibold">
                  Parcial 2
                </Text>
                <View className="flex-row items-center">
                  <Text className="text-red-700 text-lg font-semibold text-center mr-1">
                    {gradeValue.parcial2 || 0}
                  </Text>
                  <Pressable
                    onPress={() =>
                      editGrade("parcial2", gradeValue.parcial2 || 0)
                    }
                    className="bg-red-100 rounded-full p-1"
                  >
                    <FontAwesome6 name="pen" size={12} color="#b91c1c" />
                  </Pressable>
                </View>
              </View>

              {/* Parcial 3 */}
              <View>
                <Text className="text-blue-700 text-lg font-semibold">
                  Parcial 3
                </Text>
                <View className="flex-row items-center">
                  <Text className="text-blue-700 text-lg font-semibold text-center mr-1">
                    {gradeValue.parcial3 || 0}
                  </Text>
                  <Pressable
                    onPress={() =>
                      editGrade("parcial3", gradeValue.parcial3 || 0)
                    }
                    className="bg-blue-100 rounded-full p-1"
                  >
                    <FontAwesome6 name="pen" size={12} color="#1d4ed8" />
                  </Pressable>
                </View>
              </View>

              {/* Promedio */}
              <View>
                <Text className="text-green-700 text-lg font-semibold">
                  Promedio
                </Text>
                <Text className="text-green-700 text-lg font-semibold text-center">
                  {getAvg({
                    calif1: gradeValue.parcial1,
                    calif2: gradeValue.parcial2,
                    calif3: gradeValue.parcial3,
                  }).toFixed(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Rastreo emocional */}
        <View className="flex-1 px-6 py-2">
          <View className="bg-white rounded-lg p-4 mb-4">
            <Text className="text-2xl font-bold mb-2">
              Seguimiento Emocional
            </Text>

            <View>
              <Text className="text-lg font-semibold mb-2">
                Últimos 30 días
              </Text>
              {cargando ? (
                <></>
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
                  />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Evidencia médica */}

        <ScrollView className="flex-1">
          <View className="p-6">
            <View className="bg-white rounded-lg p-4 mb-4">
              <Text className="text-2xl font-bold mb-4">Evidencia médica</Text>

              {error && <Text className="text-red-500 mb-4">{error}</Text>}

              <Text className="text-lg font-semibold mb-3">
                Documentos subidos
              </Text>

              {cargando ? (
                <></>
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
            </View>
          </View>
        </ScrollView>

        {/* Condicion médica */}
        <View className="flex-1 px-6">
          <View className="bg-white rounded-lg p-4 mb-4">
            <Text className="text-2xl font-semibold">Condición Médica</Text>
            {error && <Text className="text-red-500 mb-4">{error}</Text>}

            {/* Sección de Alergias */}
            <View className="mt-6">
              <Text className="text-lg font-semibold mb-2">Alergias</Text>
              <View className="flex-row flex-wrap mb-2">
                {datosClinicos.alergias.length > 0 ? (
                  datosClinicos.alergias.map((alergia, index) => (
                    <Pressable
                      key={index}
                      className="bg-blue-100 px-3 py-1 rounded-full mr-2 mb-2 flex-row items-center"
                    >
                      <Text className="text-blue-800">{alergia}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text className="text-gray-500">
                    No hay alergias registradas
                  </Text>
                )}
              </View>
            </View>

            {/* Sección de Enfermedades */}
            <View className="">
              <Text className="text-lg font-semibold mb-2">Padecimientos</Text>
              <View className="flex-row flex-wrap mb-2">
                {datosClinicos.enfermedades.length > 0 ? (
                  datosClinicos.enfermedades.map((enfermedad, index) => (
                    <Pressable
                      key={index}
                      className="bg-green-100 px-3 py-1 rounded-full mr-2 mb-2 flex-row items-center"
                    >
                      <Text className="text-green-800">{enfermedad}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text className="text-gray-500">
                    No hay enfermedades registradas
                  </Text>
                )}
              </View>
            </View>

            {/* Sección de Medicaciones */}
            <View className="mb-4">
              <Text className="text-lg font-semibold mb-2">Medicaciones</Text>
              <View className="flex-row flex-wrap mb-2">
                {datosClinicos.medicaciones.length > 0 ? (
                  datosClinicos.medicaciones.map((medicacion, index) => (
                    <Pressable
                      key={index}
                      className="bg-purple-100 px-3 py-1 rounded-full mr-2 mb-2 flex-row items-center"
                    >
                      <Text className="text-purple-800">{medicacion}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text className="text-gray-500">
                    No hay medicaciones registradas
                  </Text>
                )}
              </View>
            </View>

            {/* Sección de Condiciones especiales */}
            <View className="mb-6">
              <Text className="text-lg font-semibold mb-2">
                Condiciones especiales
              </Text>

              {/* Discapacidad visual */}
              {datosClinicos.discapacidades.length > 0 ? (
                <View>
                  {datosClinicos.discapacidades.includes(
                    "Discapacidad visual"
                  ) && (
                    <View className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <FontAwesome6 name="eye" size={24} color="#4b5563" />
                        <Text className="ml-2 text-lg font-medium">
                          Discapacidad visual
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Discapacidad auditiva */}
                  {datosClinicos.discapacidades.includes(
                    "Discapacidad auditiva"
                  ) && (
                    <View className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <FontAwesome6
                          name="ear-deaf"
                          size={24}
                          color="#4b5563"
                        />
                        <Text className="ml-2 text-lg font-medium">
                          Discapacidad auditiva
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Discapacidad del habla */}
                  {datosClinicos.discapacidades.includes(
                    "Discapacidad del habla"
                  ) && (
                    <View className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <Foundation
                          name="megaphone"
                          size={24}
                          color="#4b5563"
                        />
                        <Text className="ml-2 text-lg font-medium">
                          Discapacidad del habla
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Discapacidad motriz */}
                  {datosClinicos.discapacidades.includes(
                    "Discapacidad motriz"
                  ) && (
                    <View className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <FontAwesome6
                          name="wheelchair"
                          size={24}
                          color="#4b5563"
                        />
                        <Text className="ml-2 text-lg font-medium">
                          Discapacidad motriz
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Trastornos del aprendizaje */}
                  {["TDAH", "Asperger", "Autismo", "Dislexia"].some(
                    (disability) =>
                      datosClinicos.discapacidades.includes(disability)
                  ) && (
                    <View className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <FontAwesome6 name="brain" size={24} color="#4b5563" />
                        <Text className="ml-2 text-lg font-medium">
                          Trastornos del aprendizaje
                        </Text>
                      </View>
                      <View className="flex-row flex-wrap pl-8">
                        {["TDAH", "Asperger", "Autismo", "Dislexia"].map(
                          (trastorno) =>
                            datosClinicos.discapacidades.includes(
                              trastorno
                            ) && (
                              <View
                                key={trastorno}
                                className="bg-amber-100 px-3 py-1 rounded-full mr-2 mb-2"
                              >
                                <Text className="text-amber-800">
                                  {trastorno}
                                </Text>
                              </View>
                            )
                        )}
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <Text className="text-gray-500">
                  No hay condiciones especiales registradas
                </Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
      {renderEditGradeModal()}
    </View>
  );
}
