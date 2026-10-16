import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/mobile_api_client.dart';
import '../core/app_colors.dart';
import '../core/env.dart';

/// Campañas push (Pro+) — mobile counterpart of the web /campaigns page.
/// Same rules come from the backend (src/lib/push/campaigns.ts).
class CampaignsScreen extends StatefulWidget {
  const CampaignsScreen({super.key});

  @override
  State<CampaignsScreen> createState() => _CampaignsScreenState();
}

class _CampaignsScreenState extends State<CampaignsScreen> {
  final _api = MobileApiClient();
  final _title = TextEditingController();
  final _body = TextEditingController();

  bool _loading = true;
  bool _sending = false;
  String? _error;
  String? _success;
  CampaignsData? _data;
  String? _cardId;
  DateTime? _scheduledAt;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final d = await _api.getCampaigns();
      setState(() { _data = d; _loading = false; });
    } catch (e) {
      setState(() { _error = 'No se pudieron cargar las campañas'; _loading = false; });
    }
  }

  Future<void> _pickSchedule() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
    if (time == null) return;
    setState(() => _scheduledAt = DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }

  Future<void> _send() async {
    setState(() { _sending = true; _error = null; _success = null; });
    try {
      final res = await _api.createCampaign({
        'title': _title.text.trim(),
        'body': _body.text.trim(),
        if (_cardId != null) 'loyaltyCardId': _cardId,
        if (_scheduledAt != null) 'scheduledAt': _scheduledAt!.toUtc().toIso8601String(),
      });
      if (res.containsKey('error')) {
        setState(() { _error = res['error'] as String; _sending = false; });
        return;
      }
      _title.clear();
      _body.clear();
      setState(() {
        _success = _scheduledAt != null ? 'Campaña programada' : 'Campaña enviada';
        _scheduledAt = null;
        _sending = false;
      });
      await _load();
    } catch (e) {
      setState(() { _error = 'Error de conexión'; _sending = false; });
    }
  }

  Future<void> _cancel(String id) async {
    await _api.cancelCampaign(id);
    await _load();
  }

  Color _statusColor(String s) => switch (s) {
        'sent' => const Color(0xFF0A9F5B),
        'scheduled' => const Color(0xFFFBBF24),
        'failed' => const Color(0xFFEF4444),
        _ => context.colors.textMuted,
      };

  String _statusLabel(String s) => switch (s) {
        'sent' => 'Enviada',
        'scheduled' => 'Programada',
        'failed' => 'Cancelada / fallida',
        _ => 'Borrador',
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('Campañas push')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF0A9F5B)))
          : _data == null
              ? Center(child: Text(_error ?? 'Error', style: TextStyle(color: colors.textMuted)))
              : !_data!.eligible
                  ? _upsell(colors)
                  : ListView(padding: const EdgeInsets.all(20), children: [
                      Text('Envía promociones a los clientes que tienen tu tarjeta activa.',
                          style: TextStyle(color: colors.textSecondary, fontSize: 13)),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _title,
                        maxLength: 60,
                        decoration: const InputDecoration(hintText: 'Título (ej. ¡2x1 en café hoy!)'),
                      ),
                      TextField(
                        controller: _body,
                        maxLength: 150,
                        maxLines: 2,
                        decoration: const InputDecoration(hintText: 'Mensaje'),
                      ),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String?>(
                        initialValue: _cardId,
                        decoration: const InputDecoration(labelText: 'Destinatarios'),
                        items: [
                          const DropdownMenuItem<String?>(value: null, child: Text('Todos mis clientes')),
                          ..._data!.cards.map((c) => DropdownMenuItem<String?>(value: c.id, child: Text('Tarjeta: ${c.name}'))),
                        ],
                        onChanged: (v) => setState(() => _cardId = v),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: _pickSchedule,
                        icon: const Icon(Icons.schedule, size: 18),
                        label: Text(_scheduledAt == null
                            ? 'Enviar ahora (toca para programar)'
                            : 'Programada: ${_scheduledAt!.day}/${_scheduledAt!.month}/${_scheduledAt!.year} '
                                '${_scheduledAt!.hour.toString().padLeft(2, '0')}:${_scheduledAt!.minute.toString().padLeft(2, '0')}'),
                      ),
                      if (_scheduledAt != null)
                        TextButton(onPressed: () => setState(() => _scheduledAt = null), child: const Text('Quitar programación')),
                      if (_error != null) ...[
                        const SizedBox(height: 8),
                        Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                      ],
                      if (_success != null) ...[
                        const SizedBox(height: 8),
                        Text(_success!, style: const TextStyle(color: Color(0xFF0A9F5B))),
                      ],
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        onPressed: _sending ? null : _send,
                        icon: const Icon(Icons.send),
                        label: _sending
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : Text(_scheduledAt == null ? 'Enviar campaña' : 'Programar campaña'),
                      ),
                      const SizedBox(height: 28),
                      Text('HISTORIAL',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: colors.textMuted, letterSpacing: 1.2)),
                      const SizedBox(height: 8),
                      if (_data!.campaigns.isEmpty)
                        Text('Todavía no has enviado ninguna campaña.', style: TextStyle(color: colors.textMuted, fontSize: 13)),
                      ..._data!.campaigns.map((c) => Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(12)),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                Expanded(child: Text(c.title, style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold))),
                                Text(_statusLabel(c.status),
                                    style: TextStyle(color: _statusColor(c.status), fontSize: 11, fontWeight: FontWeight.w700)),
                              ]),
                              const SizedBox(height: 2),
                              Text(c.body, style: TextStyle(color: colors.textSecondary, fontSize: 12)),
                              if (c.recipientsCount != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text('${c.recipientsCount} destinatarios',
                                      style: TextStyle(color: colors.textMuted, fontSize: 11)),
                                ),
                              if (c.status == 'scheduled')
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton(onPressed: () => _cancel(c.id), child: const Text('Cancelar')),
                                ),
                            ]),
                          )),
                    ]),
    );
  }

  Widget _upsell(AppColors colors) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.campaign_outlined, size: 48, color: colors.textMuted),
            const SizedBox(height: 12),
            Text('Las campañas push están disponibles en los planes Pro y Premium.',
                textAlign: TextAlign.center, style: TextStyle(color: colors.textPrimary, fontSize: 15)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => launchUrl(Uri.parse('${Env.apiBaseUrl}/settings?tab=suscripcion'),
                  mode: LaunchMode.externalApplication),
              child: const Text('Ver planes'),
            ),
          ]),
        ),
      );
}
