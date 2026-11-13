package android.content;
public class Intent {
    public static final String ACTION_SEND = "android.intent.action.SEND";
    public static final String ACTION_VIEW = "android.intent.action.VIEW";
    public static final String ACTION_CREATE_DOCUMENT = "android.intent.action.CREATE_DOCUMENT";
    public static final String ACTION_OPEN_DOCUMENT = "android.intent.action.OPEN_DOCUMENT";
    public static final String CATEGORY_OPENABLE = "android.intent.category.OPENABLE";
    public static final String EXTRA_SUBJECT = "android.intent.extra.SUBJECT";
    public static final String EXTRA_TEXT = "android.intent.extra.TEXT";
    public static final String EXTRA_TITLE = "android.intent.extra.TITLE";
    public Intent(String action) {}
    public Intent(String action, android.net.Uri uri) {}
    public Intent setType(String type) { return this; }
    public Intent addCategory(String category) { return this; }
    public Intent putExtra(String name, String value) { return this; }
    public android.net.Uri getData() { return null; }
    public static Intent createChooser(Intent target, CharSequence title) { return target; }
}
