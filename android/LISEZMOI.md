# Seigneurie pour Android

Ce dossier emballe le jeu (le fichier `index.html` et le dossier `js/` à la racine du dépôt) dans une application
Android : une vue web plein écran, **sans réseau ni permission**. Le jeu lui-même reste en HTML/JS pur ; rien n'est
dupliqué, les fichiers sont copiés dans l'APK à chaque construction.

## Installer

1. Ouvrez la page **Releases** du dépôt sur le téléphone et téléchargez `Seigneurie.apk` (la plus récente).
2. Ouvrez le fichier ; si Android le demande, autorisez l'installation d'applications depuis le navigateur ou le
   gestionnaire de fichiers.
3. Une nouvelle version s'installe **par-dessus** l'ancienne : les parties sont gardées.

## Les sauvegardes, sur le long terme

- Le jeu sauvegarde toutes les 5 secondes, et aussitôt que l'application passe en arrière-plan.
- Chaque emplacement est écrit **deux fois** : dans le stockage de la vue web, et dans un fichier de l'application
  (`files/saves/`), écrit d'abord à côté puis mis à la place de l'ancien, qui est gardé en `.bak` (une coupure en
  pleine écriture ne perd rien).
- Ces fichiers ne disparaissent qu'à la **désinstallation** (ou « Effacer les données » dans les réglages).
- Ils suivent la **sauvegarde automatique d'Android** (compte Google) et le **transfert vers un nouveau téléphone**.
- Menu ☰ → **Exporter la partie** : le menu de partage d'Android envoie un code de sauvegarde où vous voulez (Drive,
  mail, notes). **Importer une partie** reprend un code copié dans le presse-papiers.

## Construire

Automatiquement : le flux `.github/workflows/apk.yml` construit et publie l'APK à chaque modification du jeu.

À la main (avec le SDK Android installé) : `gradle -p android assembleRelease`, puis
`android/app/build/outputs/apk/release/app-release.apk`.

Sans le SDK Android : `android/sans-sdk/construire.sh` télécharge sur Maven Central `apktool-lib` (qui contient aapt2
et le framework Android de référence), `dalvik-dx` et `apksig`, puis assemble, aligne et signe l'APK. Les classes
Android ne servent qu'à compiler : de simples déclarations, dans `sans-sdk/api/`.

## La clé de signature

Android n'accepte une mise à jour que si elle porte **la même signature** que la version installée ; sinon il faut
désinstaller l'ancienne (et ses parties, sauf si on les a exportées). La clé n'est **pas** dans le dépôt (un dépôt public
permettrait à n'importe qui de signer une fausse mise à jour) :

- à la main : `SEIGNEURIE_KEYSTORE=/chemin/seigneurie.keystore SEIGNEURIE_KS_PASS=… gradle -p android assembleRelease` ;
- sur GitHub : deux secrets du dépôt (*Settings → Secrets and variables → Actions → New repository secret*) :
  `SEIGNEURIE_KEYSTORE_B64` (le fichier `.keystore` encodé en base64) et `SEIGNEURIE_KS_PASS` (son mot de passe).
  Sans eux, le flux signe avec une clé provisoire et le dit dans la note de version.

Gardez la clé en lieu sûr : la perdre, c'est ne plus pouvoir mettre à jour l'application sans la désinstaller.
