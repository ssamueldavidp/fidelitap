import 'supabase_client.dart';

enum AppRole { owner, customer, none }

Future<AppRole> resolveRole() async {
  final user = supabase.auth.currentUser;
  if (user == null) return AppRole.none;

  final business = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();
  if (business != null) return AppRole.owner;

  final card = await supabase
      .from('customer_cards')
      .select('id')
      .eq('linked_auth_user_id', user.id)
      .limit(1)
      .maybeSingle();
  if (card != null) return AppRole.customer;

  return AppRole.none;
}
