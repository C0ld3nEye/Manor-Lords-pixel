import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** Signe un APK (schémas v1 et v2) avec la clé d'un fichier .keystore (PKCS12), puis vérifie la signature.
 *  java -cp apksig.jar:. SignerApk entree.apk sortie.apk cle.keystore alias  (mot de passe : variable SEIGNEURIE_KS_PASS) */
public class SignerApk {
    public static void main(String[] a) throws Exception {
        char[] pass = System.getenv("SEIGNEURIE_KS_PASS").toCharArray();
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(a[2])) { ks.load(in, pass); }
        PrivateKey key = (PrivateKey) ks.getKey(a[3], pass);
        X509Certificate cert = (X509Certificate) ks.getCertificate(a[3]);
        ApkSigner.SignerConfig sc = new ApkSigner.SignerConfig.Builder("SEIGNEUR", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(sc))
            .setInputApk(new File(a[0])).setOutputApk(new File(a[1]))
            .setMinSdkVersion(24).setV1SigningEnabled(true).setV2SigningEnabled(true)
            .build().sign();
        ApkVerifier.Result r = new ApkVerifier.Builder(new File(a[1])).build().verify();
        System.out.println("signature vérifiée : " + r.isVerified() + " (v1 " + r.isVerifiedUsingV1Scheme() + ", v2 " + r.isVerifiedUsingV2Scheme() + ")");
        for (Object e : r.getErrors()) System.out.println("erreur : " + e);
        if (!r.isVerified()) System.exit(1);
    }
}
