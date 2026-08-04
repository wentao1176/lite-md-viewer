plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.xwt.litemdviewer"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.xwt.litemdviewer"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

// 解决 Prism4j 传递的 annotations-java5 与 annotations 冲突
configurations.all {
    exclude(group = "org.jetbrains", module = "annotations-java5")
}

dependencies {
    // 核心
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")

    // Compose
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Markdown 渲染（Markwon）
    implementation("io.noties.markwon:core:4.6.2")
    implementation("io.noties.markwon:ext-tables:4.6.2")          // 表格
    implementation("io.noties.markwon:ext-strikethrough:4.6.2")   // 删除线
    implementation("io.noties.markwon:ext-tasklist:4.6.2")        // 任务列表
    implementation("io.noties.markwon:image:4.6.2")               // 图片
    implementation("io.noties.markwon:ext-latex:4.6.2")           // LaTeX 公式（JLatexMath）

    // Markdown → HTML（导出 PDF 用；与 JLatexMath 的 atlassian.commonmark 保持同一版本族）
    implementation("com.atlassian.commonmark:commonmark:0.13.0")
    implementation("com.atlassian.commonmark:commonmark-ext-gfm-tables:0.13.0")
    implementation("com.atlassian.commonmark:commonmark-ext-gfm-strikethrough:0.13.0")
}
