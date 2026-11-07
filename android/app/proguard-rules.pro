# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# TorrentFlow Native JNI & Services
-keepclassmembers class * {
    native <methods>;
}
-keep class org.libtorrent4j.** { *; }
-dontwarn org.libtorrent4j.**
-keep class com.torrentflow.mobile.native.** { *; }
-keepclassmembers class com.torrentflow.mobile.native.TorrentEngineJni { *; }
-keep class com.torrentflow.mobile.bridge.** { *; }
-keep class com.torrentflow.mobile.service.** { *; }
-keep class com.torrentflow.mobile.torrent.** { *; }
