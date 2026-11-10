import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { Card } from '../src/components/Card';

export default function LicensesScreen() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();

  const licenses = [
    {
      name: 'libtorrent (rasterbar)',
      version: '2.1.x',
      license: 'BSD 3-Clause License',
      author: 'Copyright (c) 2003-2024, Arvid Norberg',
      text: 'Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met: (1) Redistributions of source code must retain the above copyright notice; (2) Redistributions in binary form must reproduce the above copyright notice.',
    },
    {
      name: 'React Native',
      version: '0.81.5',
      license: 'MIT License',
      author: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      text: 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.',
    },
    {
      name: 'Expo SDK',
      version: '54.0.0',
      license: 'MIT License',
      author: 'Copyright (c) 2015-present 650 Industries, Inc.',
      text: 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies.',
    },
    {
      name: 'SQLite',
      version: '3.x',
      license: 'Public Domain',
      author: 'SQLite Development Team',
      text: 'All of the code and documentation in SQLite has been dedicated to the public domain by the authors. All code may be freely copied, modified, published, used, compiled, sold, or distributed, in source code form or as a compiled binary, for any purpose, commercial or non-commercial.',
    },
    {
      name: 'OpenSSL',
      version: '3.x',
      license: 'Apache License 2.0',
      author: 'Copyright (c) 1998-2024 The OpenSSL Project Authors',
      text: 'Licensed under the Apache License, Version 2.0. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0. Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.',
    },
    {
      name: 'Boost C++ Libraries',
      version: '1.8x',
      license: 'Boost Software License 1.0',
      author: 'Boost Software Contributors',
      text: 'Permission is hereby granted, free of charge, to any person or organization obtaining a copy of the software and accompanying documentation covered by this license to use, reproduce, display, distribute, execute, and transmit the Software.',
    },
  ];

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/settings');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider, paddingHorizontal: spacing.lg }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.backBtn, { backgroundColor: colors.surfaceVariant }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <View style={styles.brandBadgeRow}>
            <Image
              source={require('../assets/logo-transparent.png')}
              style={styles.logoTiny}
              resizeMode="contain"
            />
            <Text style={[styles.brand, { color: colors.primaryLight, fontSize: typography.sizes.caption }]}>
              INPAND TORRENT
            </Text>
          </View>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: typography.sizes.title }]}>
            Open Source Licenses
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={true}
      >
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            Inpand Torrent is built with the support of phenomenal open-source software. We gratefully acknowledge the authors and contributors of the projects below.
          </Text>
        </Card>

        {licenses.map((lic, idx) => (
          <Card key={idx} style={{ marginBottom: spacing.md }}>
            <View style={styles.licHeader}>
              <Text style={[styles.libName, { color: colors.text }]}>{lic.name}</Text>
              <View style={[styles.licPill, { backgroundColor: `${colors.primary}20` }]}>
                <Text style={[styles.licPillText, { color: colors.primaryLight }]}>{lic.license}</Text>
              </View>
            </View>
            <Text style={[styles.authorText, { color: colors.textMuted, marginTop: 4 }]}>
              {lic.author} ({lic.version})
            </Text>
            <Text style={[styles.licBody, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              {lic.text}
            </Text>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    alignItems: 'center',
  },
  brandBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoTiny: {
    width: 18,
    height: 18,
  },
  brand: {
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontWeight: '800',
  },
  content: {
    paddingBottom: 32,
  },
  introText: {
    fontSize: 13,
    lineHeight: 18,
  },
  licHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  libName: {
    fontSize: 16,
    fontWeight: '700',
  },
  licPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  licPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  authorText: {
    fontSize: 12,
  },
  licBody: {
    fontSize: 12,
    lineHeight: 18,
  },
});
