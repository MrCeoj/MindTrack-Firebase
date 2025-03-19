import { SafeAreaView } from "react-native";
import { Redirect } from "expo-router";
import '../global.css';

export default function Index() {
  return (
    <SafeAreaView>
      <Redirect href={"./auth/Login"} />
    </SafeAreaView>
  );
}
