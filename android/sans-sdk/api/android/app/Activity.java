package android.app;
public class Activity extends android.content.Context {
    public static final int RESULT_OK = -1;
    public void startActivityForResult(android.content.Intent intent, int requestCode) {}
    protected void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {}
    public android.content.ContentResolver getContentResolver() { return null; }
    protected void onCreate(android.os.Bundle b) {}
    protected void onPause() {}
    protected void onDestroy() {}
    public void onBackPressed() {}
    public final boolean requestWindowFeature(int featureId) { return true; }
    public void setContentView(android.view.View v) {}
    public void finish() {}
    public final void runOnUiThread(Runnable r) {}
    public java.io.File getFilesDir() { return null; }
    public Object getSystemService(String name) { return null; }
    public void startActivity(android.content.Intent i) {}
}
