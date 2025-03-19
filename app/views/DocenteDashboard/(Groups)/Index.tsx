import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { auth } from "../../../../FirebaseConfig";
import { Picker } from "@react-native-picker/picker";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

function DocenteDashboard() {
  interface UserData {
    nombre: string;
    rfc: string;
    email: string;
    [key: string]: any;
  }

  interface Grupo {
    id: string;
    nombre: string;
    materiaId: string;
    materiaNombre: string;
    cicloEscolar: string;
    horario: {
      dias: string[];
      horaInicio: string;
      horaFin: string;
    };
    alumnosInscritos: [];
    semestre: number;
  }

  interface Materia {
    id: string;
    nombre: string;
    carreraId: string;
    carreraNombre: string;
    semestre: number;
  }

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);

  // Estados para el modal de creación de grupo
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMateria, setSelectedMateria] = useState("");
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [cicloEscolar, setCicloEscolar] = useState("");
  const [diasSeleccionados, setDiasSeleccionados] = useState<{
    [key: string]: boolean;
  }>({
    Lunes: false,
    Martes: false,
    Miércoles: false,
    Jueves: false,
    Viernes: false,
    Sábado: false,
  });
  const [horaInicio, setHoraInicio] = useState("07:00");
  const [horaFin, setHoraFin] = useState("09:00");
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          router.replace("/");
          return;
        }

        const db = getFirestore();
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        const docenteDoc = await getDoc(doc(db, "docentes", user.uid));

        if (userDoc.exists() && docenteDoc.exists()) {
          setUserData({
            nombre: userDoc.data().nombre,
            rfc: docenteDoc.data().rfc,
            email: userDoc.data().email,
            ...userDoc.data(),
            ...docenteDoc.data(),
          });
        } else {
          Alert.alert("Error", "No se pudo cargar la información del usuario");
        }
      } catch (error) {
        console.error("Error al cargar datos del usuario:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    if (userData) {
      fetchGrupos();
      fetchMaterias();
    }
  }, [userData]);

  const fetchGrupos = async () => {
    setLoadingGrupos(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const db = getFirestore();
      const gruposRef = collection(db, "grupos");
      const q = query(gruposRef, where("docenteId", "==", user.uid));
      const querySnapshot = await getDocs(q);

      const gruposData: Grupo[] = [];

      for (const grupoDoc of querySnapshot.docs) {
        const grupoData = grupoDoc.data();

        // Obtener datos de la materia para mostrar nombre
        let materiaNombre = "";
        if (grupoData.materiaId) {
          const materiaDoc = await getDoc(
            doc(db, "materias", grupoData.materiaId)
          );
          if (materiaDoc.exists()) {
            materiaNombre = materiaDoc.data().nombre;
          }
        }

        gruposData.push({
          id: grupoDoc.id,
          nombre: grupoData.nombre,
          materiaId: grupoData.materiaId,
          materiaNombre: materiaNombre,
          cicloEscolar: grupoData.cicloEscolar,
          horario: grupoData.horario,
          alumnosInscritos: grupoData.alumnosInscritos || [],
          semestre: grupoData.semestre,
        });
      }

      setGrupos(gruposData);
    } catch (error) {
      console.error("Error al cargar grupos:", error);
      Alert.alert("Error", "No se pudieron cargar los grupos");
    } finally {
      setLoadingGrupos(false);
    }
  };

  const fetchMaterias = async () => {
    try {
      const db = getFirestore();
      const materiasRef = collection(db, "materias");
      const querySnapshot = await getDocs(materiasRef);

      const materiasData: Materia[] = [];

      for (const materiaDoc of querySnapshot.docs) {
        const materiaData = materiaDoc.data();

        // Obtener nombre de la carrera
        let carreraNombre = "";
        if (materiaData.carreraId) {
          const carreraDoc = await getDoc(
            doc(db, "carreras", materiaData.carreraId)
          );
          if (carreraDoc.exists()) {
            carreraNombre = carreraDoc.data().nombre;
          }
        }

        materiasData.push({
          id: materiaDoc.id,
          nombre: materiaData.nombre,
          carreraId: materiaData.carreraId,
          carreraNombre: carreraNombre,
          semestre: materiaData.semestre,
        });
      }

      setMaterias(materiasData);
    } catch (error) {
      console.error("Error al cargar materias:", error);
      Alert.alert("Error", "No se pudieron cargar las materias");
    }
  };

  const toggleDiaSeleccion = (dia: string) => {
    setDiasSeleccionados({
      ...diasSeleccionados,
      [dia]: !diasSeleccionados[dia],
    });
  };

  const crearNuevoGrupo = async () => {
    // Validaciones
    if (!selectedMateria) {
      Alert.alert("Error", "Selecciona una materia");
      return;
    }
    if (!nombreGrupo.trim()) {
      Alert.alert("Error", "Ingresa un nombre para el grupo");
      return;
    }
    if (!cicloEscolar.trim()) {
      Alert.alert("Error", "Ingresa el ciclo escolar");
      return;
    }

    const diasSeleccionadosArray = Object.keys(diasSeleccionados).filter(
      (dia) => diasSeleccionados[dia]
    );

    if (diasSeleccionadosArray.length === 0) {
      Alert.alert("Error", "Selecciona al menos un día");
      return;
    }

    setCreatingGroup(true);

    try {
      const user = auth.currentUser;
      if (!user) return;

      const db = getFirestore();

      // Obtener información de la materia seleccionada
      const materiaSeleccionada = materias.find(
        (mat) => mat.id === selectedMateria
      );

      if (!materiaSeleccionada) {
        throw new Error("No se encontró la materia seleccionada");
      }

      // Crear nuevo grupo
      const nuevoGrupo = {
        materiaId: selectedMateria,
        docenteId: user.uid,
        nombre: nombreGrupo,
        cicloEscolar: cicloEscolar,
        horario: {
          dias: diasSeleccionadosArray,
          horaInicio: horaInicio,
          horaFin: horaFin,
        },
        alumnosInscritos: [],
        activo: true,
        fechaCreacion: new Date().toISOString(),
        semestre: materiaSeleccionada.semestre, // Usar el semestre de la materia encontrada
      };

      const grupoRef = await addDoc(collection(db, "grupos"), nuevoGrupo);

      // Actualizar el documento del docente para incluir este grupo
      const docenteRef = doc(db, "docentes", user.uid);
      await updateDoc(docenteRef, {
        gruposActivos: arrayUnion(grupoRef.id),
      });

      Alert.alert("Éxito", "Grupo creado correctamente");
      setModalVisible(false);

      // Limpiar campos
      setNombreGrupo("");
      setSelectedMateria("");
      setCicloEscolar("");
      setDiasSeleccionados({
        Lunes: false,
        Martes: false,
        Miércoles: false,
        Jueves: false,
        Viernes: false,
        Sábado: false,
      });
      setHoraInicio("07:00");
      setHoraFin("09:00");

      // Recargar grupos
      fetchGrupos();
    } catch (error) {
      console.error("Error al crear grupo:", error);
      Alert.alert("Error", "No se pudo crear el grupo");
    } finally {
      setCreatingGroup(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-wine-dark">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text className="text-white text-lg mt-2">Cargando...</Text>
      </View>
    );
  }

  const handleNavigation = (grupo: any) => {
    router.push({
      pathname: "./Group",
      params: { grupo: JSON.stringify(grupo) },
    });
  };

  return (
    <ScrollView className="flex-1 flex flex-col h-full ">
      <View className="bg-white rounded-lg p-4 mb-4">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-3xl font-semibold">Mis Grupos</Text>
          <Pressable
            className="bg-blue-500 px-4 py-2 rounded-lg"
            onPress={() => setModalVisible(true)}
          >
            <Text className="text-white font-semibold">Crear Grupo</Text>
          </Pressable>
        </View>

        {loadingGrupos ? (
          <ActivityIndicator size="small" color="#0000ff" />
        ) : grupos.length === 0 ? (
          <Text className="text-gray-500 text-center py-4">
            No tienes grupos asignados. Crea uno nuevo para comenzar.
          </Text>
        ) : (
          grupos.map((grupo) => (
            <View
              key={grupo.id}
              className="border border-gray-200 opacity-90 bg-pink-button rounded-lg p-3 mb-3 w-full flex flex-row justify-between items-center"
            >
              <View className="w-3/4">
                <Text className="font-bold text-2xl text-white">
                  Grupo: {grupo.nombre}
                </Text>
                <Text className="text-lg text-white">
                  Materia: {grupo.materiaNombre}
                </Text>
                <Text className="text-lg text-white">Semestre: {grupo.semestre}</Text>
                <Text className="text-lg text-white">Ciclo: {grupo.cicloEscolar}</Text>
                <Text className="text-lg text-white">
                  Horario: {grupo.horario.dias.join(", ")}{" "}
                  {grupo.horario.horaInicio} - {grupo.horario.horaFin}
                </Text>
              </View>
              <Pressable
                className="mr-2 items-center"
                onPress={() => handleNavigation(grupo)}
              >
                <FontAwesome6
                  name="magnifying-glass-chart"
                  size={42}
                  color="white"
                />
                <Text className="text-white mt-2 text-xl font-semibold">Revisar</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      {/* Modal para crear un nuevo grupo */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-lg p-6 w-11/12 max-h-5/6">
            <ScrollView>
              <Text className="text-2xl font-bold mb-4 text-center">
                Crear Nuevo Grupo
              </Text>

              <Text className="font-semibold mb-1 mt-2">Materia:</Text>
              <View className="border border-gray-300 rounded mb-4">
                <Picker
                  selectedValue={selectedMateria}
                  onValueChange={(itemValue) => setSelectedMateria(itemValue)}
                >
                  <Picker.Item label="Selecciona una materia" value="" />
                  {materias.map((materia) => (
                    <Picker.Item
                      key={materia.id}
                      label={`${materia.nombre} - ${materia.carreraNombre} (Sem ${materia.semestre})`}
                      value={materia.id}
                    />
                  ))}
                </Picker>
              </View>

              <Text>
                Semestre:{" "}
                {materias.find((mat) => mat.id === selectedMateria)?.semestre}
              </Text>

              <Text className="font-semibold mb-1">Nombre del Grupo:</Text>
              <TextInput
                className="border border-gray-300 rounded p-2 mb-4"
                placeholder="Ej: Grupo A"
                value={nombreGrupo}
                onChangeText={setNombreGrupo}
              />

              <Text className="font-semibold mb-1">Ciclo Escolar:</Text>
              <TextInput
                className="border border-gray-300 rounded p-2 mb-4"
                placeholder="Ej: 2025A"
                value={cicloEscolar}
                onChangeText={setCicloEscolar}
              />

              <Text className="font-semibold mb-2">Días de clase:</Text>
              <View className="flex-row flex-wrap mb-4">
                {Object.keys(diasSeleccionados).map((dia) => (
                  <Pressable
                    key={dia}
                    className={`mr-2 mb-2 px-3 py-1 rounded ${
                      diasSeleccionados[dia] ? "bg-blue-500" : "bg-gray-200"
                    }`}
                    onPress={() => toggleDiaSeleccion(dia)}
                  >
                    <Text
                      className={`${
                        diasSeleccionados[dia] ? "text-white" : "text-gray-800"
                      }`}
                    >
                      {dia}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View className="flex-row justify-between mb-4">
                <View className="w-5/12">
                  <Text className="font-semibold mb-1">Hora Inicio:</Text>
                  <TextInput
                    className="border border-gray-300 rounded p-2"
                    placeholder="07:00"
                    value={horaInicio}
                    onChangeText={setHoraInicio}
                  />
                </View>
                <View className="w-5/12">
                  <Text className="font-semibold mb-1">Hora Fin:</Text>
                  <TextInput
                    className="border border-gray-300 rounded p-2"
                    placeholder="09:00"
                    value={horaFin}
                    onChangeText={setHoraFin}
                  />
                </View>
              </View>

              <View className="flex-row justify-around mt-4">
                <Pressable
                  className="bg-gray-400 px-6 py-2 rounded-lg"
                  onPress={() => setModalVisible(false)}
                >
                  <Text className="text-white font-semibold">Cancelar</Text>
                </Pressable>
                <Pressable
                  className="bg-blue-500 px-6 py-2 rounded-lg"
                  onPress={crearNuevoGrupo}
                  disabled={creatingGroup}
                >
                  {creatingGroup ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-white font-semibold">Guardar</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

export default DocenteDashboard;
