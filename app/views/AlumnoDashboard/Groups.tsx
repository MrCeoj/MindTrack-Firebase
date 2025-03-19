import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
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
import { auth } from "../../FirebaseConfig";
import { FontAwesome6 } from "@expo/vector-icons";
import { set } from "date-fns";
import { router } from "expo-router";

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
  alumnosInscritos: string[];
  semestre: number;
  docente: string;
}

interface UserData {
  carrera: string;
  semestre: number;
  nombre: string;
  email: string;
}

interface Horario {
  dias: string[];
  horaInicio: string;
  horaFin: string;
}

const GruposDisponiblesScreen = () => {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [gruposInscritos, setGruposInscritos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const inscribirseAGrupo = async (grupo: Grupo) => {
    try {
      setLoading(true);

      const db = getFirestore();
      const user = auth.currentUser;

      if (!user) {
        throw new Error("Usuario no autenticado");
      }

      // Verificar si el grupo ya tiene al alumno inscrito
      const grupoRef = doc(db, "grupos", grupo.id);
      const grupoDoc = await getDoc(grupoRef);

      if (!grupoDoc.exists()) {
        throw new Error("El grupo no existe");
      }

      const grupoData = grupoDoc.data();

      if (grupoData.alumnosInscritos?.includes(user.uid)) {
        throw new Error("Ya estás inscrito en este grupo.");
      }

      // Actualizar el grupo con el alumno inscrito
      await updateDoc(grupoRef, {
        alumnosInscritos: arrayUnion(user.uid),
      });

      // Actualizar el documento del alumno con el grupo inscrito
      const alumnoRef = doc(db, "alumnos", user.uid);
      await updateDoc(alumnoRef, {
        gruposInscritos: arrayUnion(grupo.id),
      });

      // Crear documento para las calificaciones del alumno en este grupo
      await addDoc(collection(db, "calificaciones"), {
        alumnoId: user.uid,
        grupoId: grupo.id,
        materiaId: grupo.materiaId,
        parcial1: 0,
        parcial2: 0,
        parcial3: 0,
        fechaInscripcion: new Date(),
      });

      alert(`Te has inscrito correctamente en el grupo ${grupoData.nombre}`);

      setGruposInscritos([...gruposInscritos, grupo]);
      setGrupos(grupos.filter((g) => g.id !== grupo.id));
    } catch (error) {
      console.error("Error al inscribirse al grupo:", error);
      alert((error as any).message || "No se pudo completar la inscripción");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const db = getFirestore();
        const user = auth.currentUser;

        if (!user) {
          throw new Error("Usuario no autenticado");
        }

        // Obtener datos del usuario
        const userAl = await getDoc(doc(db, "usuarios", user.uid));
        const alumnoDoc = await getDoc(doc(db, "alumnos", user.uid));

        if (userAl.exists() && alumnoDoc.exists()) {
          const userData = alumnoDoc.data() as UserData;
          const carreraAlumno = userData.carrera;
          const semestreAlumno = userData.semestre;

          // Obtener materias y grupos solo cuando carrera y semestre estén definidos
          const materiasQuery = query(
            collection(db, "materias"),
            where("carreraId", "==", carreraAlumno),
            where("semestre", "==", semestreAlumno)
          );

          const materiasSnapshot = await getDocs(materiasQuery);
          const materiasData: { [key: string]: any } = {};

          materiasSnapshot.forEach((doc) => {
            materiasData[doc.id] = doc.data();
          });

          if (materiasSnapshot.size > 0) {
            const materiasIds = Object.keys(materiasData);

            const gruposQuery = query(
              collection(db, "grupos"),
              where("materiaId", "in", materiasIds),
              where("semestre", "==", semestreAlumno)
            );

            const gruposSnapshot = await getDocs(gruposQuery);
            const gruposDisponibles: Grupo[] = [];

            for (const document of gruposSnapshot.docs) {
              const grupoData = document.data();
              const docente = grupoData.docenteId;

              if (docente) {
                const docenteRef = doc(db, "usuarios", docente);
                const docenteDoc = await getDoc(docenteRef);
                grupoData.docente = docenteDoc.exists()
                  ? `${docenteDoc.data().nombre} ${docenteDoc.data().apellidos}`
                  : "Docente no asignado";
              }

              gruposDisponibles.push({
                id: document.id,
                nombre: grupoData.nombre,
                materiaId: grupoData.materiaId,
                materiaNombre:
                  materiasData[grupoData.materiaId]?.nombre ||
                  "Materia no encontrada",
                cicloEscolar: grupoData.cicloEscolar,
                horario: grupoData.horario,
                alumnosInscritos: grupoData.alumnosInscritos,
                semestre: grupoData.semestre,
                docente: grupoData.docente || "Docente no asignado",
              });
            }

            const inscritos = gruposDisponibles.filter(
              (grupo) =>
                grupo.alumnosInscritos &&
                grupo.alumnosInscritos.includes(user.uid)
            );

            const disponibles = gruposDisponibles.filter(
              (grupo) =>
                !grupo.alumnosInscritos ||
                !grupo.alumnosInscritos.includes(user.uid)
            );

            console.log("Grupos disponibles:", disponibles);
            console.log("Grupos inscritos:", inscritos);

            console.log("user", user.uid);

            setGruposInscritos(inscritos);

            setGrupos(disponibles);
          } else {
            setGrupos([]);
          }
        } else {
          throw new Error("No se encontró información del alumno");
        }
      } catch (err) {
        console.error("Error al obtener datos:", err);
        setError("No se pudieron cargar los datos del usuario o grupos");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {}, [grupos, gruposInscritos]);

  // Función para mostrar el horario de forma legible
  const formatearHorario = (horario: Horario): string => {
    if (!horario) return "Horario no disponible";

    try {
      // Asumiendo que horario es un objeto con días y horas
      return horario.dias
        .map((dia) => {
          const { horaInicio, horaFin } = horario;
          return `${dia}: ${horaInicio} - ${horaFin}`;
        })
        .join(", ");
    } catch (e) {
      return "Formato de horario incorrecto";
    }
  };

  return (
    <View className="p-6 h-full flex flex-col flex-1">
      <ScrollView className="bg-white h-1/2 max-h-1/2  rounded-lg p-4 mb-4">
        <Text className="text-xl font-semibold mb-2">Grupos Disponibles</Text>

        {loading ? (
          <View className="items-center py-4">
            <ActivityIndicator size="large" color="#841617" />
            <Text className="mt-2 text-gray-600">Cargando grupos...</Text>
          </View>
        ) : error ? (
          <Text className="text-red-500 py-2">{error}</Text>
        ) : grupos.length === 0 ? (
          <Text className="text-gray-600 py-2">
            No hay grupos disponibles para tu carrera y semestre actual.
          </Text>
        ) : (
          grupos.map((grupo) => (
            <View
              key={grupo.id}
              className="border border-gray-200 rounded-lg p-3 mb-3"
            >
              <Text className="font-bold text-lg">{grupo.materiaNombre}</Text>
              <Text className="text-gray-700">Grupo: {grupo.nombre}</Text>
              <Text className="text-gray-700">
                Horario: {formatearHorario(grupo.horario)}
              </Text>
              <Text className="text-gray-700">
                Ciclo escolar: {grupo.cicloEscolar}
              </Text>
              <Text>Docente: {grupo.docente || "Docente no asignado"}</Text>
              <Pressable
                className="bg-green-600 rounded-lg p-2 mt-2 items-center"
                onPress={() => inscribirseAGrupo(grupo)}
              >
                <Text className="text-white font-semibold">Inscribirse</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <ScrollView className="bg-white h-1/2 max-h-1/2 rounded-lg p-4">
        <Text className="text-xl font-semibold mb-2">Mis Grupos</Text>
        {loading ? (
          <View className="items-center py-4">
            <ActivityIndicator size="large" color="#841617" />
            <Text className="mt-2 text-gray-600">Cargando grupos...</Text>
          </View>
        ) : error ? (
          <Text className="text-red-500 py-2">{error}</Text>
        ) : gruposInscritos.length === 0 ? (
          <Text className="text-gray-600 py-2">
            No hay grupos disponibles para tu carrera y semestre actual.
          </Text>
        ) : (
          gruposInscritos.map((grupo) => (
            <View
              key={grupo.id}
              className="border border-gray-200 bg-blue-button rounded-lg p-3 mb-3 flex flex-col justify-between"
            >
              <Text className="font-bold text-lg text-right text-white">
                {grupo.materiaNombre}
              </Text>
              <View className="">
                <Text className="text-right text-white">Grupo: {grupo.nombre}</Text>
                <Text className="text-right text-white">
                  Ciclo escolar: {grupo.cicloEscolar}
                </Text>
                <Text className="text-right text-white">
                  Docente: {grupo.docente || "Docente no asignado"}
                </Text>
                <Text className="text-right text-white my-2">
                  Horario: {formatearHorario(grupo.horario)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default GruposDisponiblesScreen;
