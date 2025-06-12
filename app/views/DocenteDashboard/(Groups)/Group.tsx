import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View, ActivityIndicator, Pressable } from "react-native";
import { get } from "react-native/Libraries/TurboModule/TurboModuleRegistry";

interface Calif {
  id: string;
  alumnoId: string;
  parcial1: number;
  parcial2: number;
  parcial3: number;
}

export default function Group() {
  const router = useRouter();
  const { grupo } = useLocalSearchParams();
  const grupoData = typeof grupo === "string" ? JSON.parse(grupo) : null;
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [califs, setCalifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const handleNavigation = (student: any) => {
    const studentCalifs = getStudentCalifs(student.id);

    router.push({
      pathname: "./Student",
      params: { data: JSON.stringify(studentCalifs) },
    });
  };

  useEffect(() => {
    if (grupoData?.nombre) {
      const newTitle = grupoData.nombre;
      router.setParams({ title: newTitle });
    }

    const db = getFirestore();

    const fetchCalifs = async () => {
      if (!grupoData || !grupoData.id) {
        setLoading(false);
        return;
      }

      try {
        const califsData: any[] = [];

        const califsQuery = query(
          collection(db, "calificaciones"),
          where("grupoId", "==", grupoData.id)
        );

        const querySnapshot = await getDocs(califsQuery);

        querySnapshot.forEach((doc) => {
          califsData.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        setCalifs(califsData);
      } catch (error) {
        console.error("Error fetching calificaciones:", error);
      }
    };

    const fetchAlumnos = async () => {
      if (
        !grupoData ||
        !grupoData.alumnosInscritos ||
        grupoData.alumnosInscritos.length === 0
      ) {
        setLoading(false);
        return;
      }

      try {
        const alumnosData = [];

        if (grupoData.alumnosInscritos.length > 0) {
          for (const alumnoId of grupoData.alumnosInscritos) {
            const alumnoDoc = await getDoc(doc(db, "alumnos", alumnoId));

            if (alumnoDoc.exists()) {
              const userDoc = await getDoc(doc(db, "usuarios", alumnoId));

              alumnosData.push({
                id: alumnoId,
                ...alumnoDoc.data(),
                ...(userDoc.exists() ? userDoc.data() : {}),
              });
            }
          }
        }

        setAlumnos(alumnosData);

        await fetchCalifs();
      } catch (error) {
        console.error("Error fetching alumnos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlumnos();
  }, []);

  if (!grupoData) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>No se encontró información del grupo</Text>
      </View>
    );
  }

  // Function to get average of califications
  const getAvg = (
    califs: Calif | { parcial1: number; parcial2: number; parcial3: number }
  ) => {
    // count number of califications that are not 0
    let count = 0;
    if (califs.parcial1 !== 0) count++;
    if (califs.parcial2 !== 0) count++;
    if (califs.parcial3 !== 0) count++;

    if (count === 0) return 0;

    return (califs.parcial1 + califs.parcial2 + califs.parcial3) / count;
  };

  // Function to get calification for a specific student

  const getStudentCalifs = (
    alumnoId: string
  ): Calif | { parcial1: number; parcial2: number; parcial3: number } => {
    return (
      califs.find((calif: Calif) => calif.alumnoId === alumnoId) || {
        parcial1: 0,
        parcial2: 0,
        parcial3: 0,
      }
    );
  };

  return (
    <View className="p-5">
      <Stack.Screen
        options={{
          title:
            grupoData.nombre + " | " + grupoData.materiaNombre ||
            "Detalles del grupo",
        }}
      />
      <View className="bg-white p-5 rounded-lg shadow">
        <Text className="text-xl font-bold mb-4">Alumnos Inscritos</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : alumnos.length === 0 ? (
          <Text className="text-gray-500 italic">
            No hay alumnos inscritos en este grupo
          </Text>
        ) : (
          alumnos.map((alumno) => {
            const studentCalifs = getStudentCalifs(alumno.id);

            return (
              <View
                key={alumno.id}
                className="border-b border-gray-200 py-2 flex flex-row justify-between"
              >
                <View className="flex flex-col w-2/3">
                  <Text className="text-xl font-semibold">
                    {alumno.nombre} {alumno.apellidos}
                  </Text>
                  <Text className="text-md font-semibold text-gray-600">
                    Matrícula: {alumno.matricula}
                  </Text>

                  <Text className="text-lg mt-1 font-semibold">
                    Promedio: {getAvg(studentCalifs).toFixed(1)}
                  </Text>
                </View>
                <Pressable
                  className="flex flex-col justify-center items-center w-1/3"
                  onPress={() => handleNavigation(alumno)}
                >
                  <MaterialCommunityIcons
                    name="file-document-multiple-outline"
                    size={56}
                    color="black"
                  />
                  <Text className="text-md mt-1 font-semibold text-gray-600 text-center">
                    Historial
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
