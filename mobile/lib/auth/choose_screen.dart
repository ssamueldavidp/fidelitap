import 'package:flutter/material.dart';

class ChooseScreen extends StatelessWidget {
  const ChooseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Spacer(),
              const Icon(Icons.loyalty, size: 64, color: Color(0xFF00C896)),
              const SizedBox(height: 16),
              const Text('FideliTap',
                  style: TextStyle(fontSize: 36, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              const Text('Tarjetas de fidelización digitales',
                  style: TextStyle(fontSize: 16, color: Color(0xFF94A3B8))),
              const Spacer(),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pushNamed('/auth/login'),
                child: const Text('Soy dueño de un negocio'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => Navigator.of(context).pushNamed('/auth/claim'),
                child: const Text('Tengo una tarjeta de cliente'),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
