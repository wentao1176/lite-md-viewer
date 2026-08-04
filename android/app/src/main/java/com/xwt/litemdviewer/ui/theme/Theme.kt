package com.xwt.litemdviewer.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// 柔和暖色系，与桌面版保持一致
private val LightColors = lightColorScheme(
    primary = Color(0xFF8A7B6F),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF6F6257),
    background = Color(0xFFFAF7F2),
    onBackground = Color(0xFF3D3A34),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF3D3A34),
    surfaceVariant = Color(0xFFF3EEE7),
    onSurfaceVariant = Color(0xFF6F6A61),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFC0B2A4),
    onPrimary = Color(0xFF2A2724),
    secondary = Color(0xFFD4C9BD),
    background = Color(0xFF2A2724),
    onBackground = Color(0xFFDDD6CD),
    surface = Color(0xFF322E2A),
    onSurface = Color(0xFFDDD6CD),
    surfaceVariant = Color(0xFF3A3530),
    onSurfaceVariant = Color(0xFFA89F93),
)

@Composable
fun LiteMdViewerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}
