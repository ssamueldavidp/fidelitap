import 'package:http/http.dart' as http;
import 'dart:convert';
import '../core/supabase_client.dart';
import '../core/env.dart';

class MobileApiClient {
  String get _base => Env.apiBaseUrl;
  String get _supabaseBase => Env.supabaseUrl;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization':
            'Bearer ${supabase.auth.currentSession?.accessToken ?? ''}',
      };

  Future<Map<String, dynamic>> get(String path) async {
    final res = await http.get(Uri.parse('$_base$path'), headers: _headers);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$_base$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> delete(String path, Map<String, dynamic> body) async {
    final res = await http.delete(
      Uri.parse('$_base$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> postFunction(
      String functionName, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$_supabaseBase/functions/v1/$functionName'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
