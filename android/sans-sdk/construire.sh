#!/usr/bin/env bash
# Construit Seigneurie.apk SANS le SDK Android, avec des outils publiés sur Maven Central :
#   apktool-lib (qui contient aapt2 et le framework Android de référence), dalvik-dx (javac → dex), apksig (signature).
# Il faut Java 17+, python3, curl. La clé : SEIGNEURIE_KEYSTORE (chemin) et SEIGNEURIE_KS_PASS (mot de passe).
# Usage : SEIGNEURIE_KEYSTORE=… SEIGNEURIE_KS_PASS=… android/sans-sdk/construire.sh [dossier de travail]
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"; DEPOT="$(cd "$ICI/../.." && pwd)"; APP="$DEPOT/android/app/src/main"
T="${1:-$(mktemp -d)}"; mkdir -p "$T/outils" "$T/res" "$T/gen" "$T/classes" "$T/assets/www/js"
M=https://repo1.maven.org/maven2
cd "$T/outils"
[ -f apktool.jar ] || curl -sSfL -o apktool.jar $M/org/apktool/apktool-lib/3.0.3/apktool-lib-3.0.3.jar
[ -f dx.jar ] || curl -sSfL -o dx.jar $M/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar
[ -f apksig.jar ] || curl -sSfL -o apksig.jar $M/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar
unzip -oq apktool.jar prebuilt/linux/aapt2 prebuilt/android-framework.jar && chmod +x prebuilt/linux/aapt2
AAPT2="$T/outils/prebuilt/linux/aapt2"; FW="$T/outils/prebuilt/android-framework.jar"
# 1) ressources et manifeste (le paquet est ajouté au manifeste, comme le fait Gradle avec « namespace »)
cp "$DEPOT/index.html" "$T/assets/www/"; cp "$DEPOT"/js/*.js "$T/assets/www/js/"
sed 's|<manifest xmlns:android="http://schemas.android.com/apk/res/android">|<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="fr.seigneurie.jeu">|' "$APP/AndroidManifest.xml" > "$T/AndroidManifest.xml"
"$AAPT2" compile --dir "$APP/res" -o "$T/res.zip"
VC=$(( $(date +%s) / 60 - 29454000 ))
"$AAPT2" link -o "$T/base.apk" -I "$FW" --manifest "$T/AndroidManifest.xml" --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VC" --version-name "0.8 (étape 8)" -A "$T/assets" --java "$T/gen" "$T/res.zip"
# 2) code Java → dex (les classes Android ne servent qu'à compiler : déclarations dans api/)
javac --release 8 -nowarn -d "$T/api" $(find "$ICI/api" -name "*.java")
javac --release 8 -nowarn -cp "$T/api" -d "$T/classes" "$APP"/java/fr/seigneurie/jeu/*.java $(find "$T/gen" -name "*.java")
java -cp "$T/outils/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=24 --output="$T/classes.dex" "$T/classes"
# 3) assemblage, alignement, signature
python3 -I "$ICI/aligner.py" "$T/base.apk" "$T/classes.dex" "$T/non-signe.apk"
javac -cp "$T/outils/apksig.jar" -d "$T/outils" "$ICI/SignerApk.java"
# (apksig 2.3.0, le seul sur Maven Central, se sert de classes internes de Java : on les lui ouvre)
JX="--add-exports=java.base/sun.security.x509=ALL-UNNAMED --add-exports=java.base/sun.security.pkcs=ALL-UNNAMED --add-exports=java.base/sun.security.util=ALL-UNNAMED"
java $JX -cp "$T/outils/apksig.jar:$T/outils" SignerApk "$T/non-signe.apk" "$T/Seigneurie.apk" "$SEIGNEURIE_KEYSTORE" "${SEIGNEURIE_KS_ALIAS:-seigneurie}"
"$AAPT2" dump badging "$T/Seigneurie.apk" | head -4
echo "APK : $T/Seigneurie.apk"
