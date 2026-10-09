import 'package:flutter/foundation.dart';
// TODO: Test app size/speed against compile-time const
// flutter build ipa 
//  --analyze-size 
final bool isApple =
    defaultTargetPlatform == TargetPlatform.iOS ||
    defaultTargetPlatform == TargetPlatform.macOS;
