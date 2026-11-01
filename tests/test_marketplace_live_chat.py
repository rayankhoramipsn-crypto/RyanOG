"""Live buyer-seller marketplace chat regression tests.
Run: python3 tests/test_marketplace_live_chat.py
"""
from pathlib import Path
from html.parser import HTMLParser
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]

class Elements(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids={}
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key=='id':
                self.ids[value]=self.ids.get(value,0)+1

class LiveChatV17(unittest.TestCase):
    def test_chat_controls_exist_exactly_once_in_both_pages(self):
        for path in ["marketplace.html","preview/marketplace.html"]:
            with self.subTest(page=path):
                source=(ROOT/path).read_text(encoding="utf-8")
                parser=Elements();parser.feed(source)
                for id_ in ["nav-messages","nav-unread","open-messages","hero-unread",
                            "seller-messages","chat-dialog","chat-connection",
                            "thread-list","bubbles","chat-form","chat-body",
                            "chat-send","chat-state","accept","chat-seller"]:
                    self.assertEqual(parser.ids.get(id_),1,id_)
                # Production cache versions may advance independently of preview.
                import re
                revision = "35" if path == "marketplace.html" else "18"
                self.assertIn("marketplace-v15.js?v="+revision, source)
                self.assertIn("marketplace-v15.css?v="+revision, source)
                self.assertIn('type="submit">Send',source)

    def test_signed_in_buyer_and_seller_receive_live_updates(self):
        code=(ROOT/"assets/marketplace-v15.js").read_text(encoding="utf-8")
        for phrase in [
            "rpc('market_inbox')", "rpc('market_mark_read'",
            "rpc('market_start_chat'", "rpc('market_send_message'",
            "market_messages'", "market_conversations'",
            "on('postgres_changes'", "subscribe(status=>",
            "startInbox()", "stopInbox()", "updateUnreadBadges(",
            "S.inboxTimer=setInterval", "messages(true)",
            "if(!selected){", "S.readMarks.set(id,key)",
            "String(c.id)===String(id)", "box.value=''",
            "chatFeedback('Message not sent.", "e.key==='Enter'&&!e.shiftKey",
        ]:
            self.assertIn(phrase,code,phrase)
        self.assertNotIn("innerHTML",code)
        self.assertNotIn("service_role",code)
        self.assertNotIn("sb_secret_",code)

    def test_policies_enforce_participant_access_and_read_receipts(self):
        sql=(ROOT/"docs/marketplace-v17-chat-inbox-realtime.sql").read_text(encoding="utf-8")
        for phrase in [
            "create table if not exists public.market_conversation_reads",
            "alter table public.market_conversation_reads enable row level security",
            "create policy market_conversation_reads_self",
            "user_id = (select auth.uid())",
            "security invoker", "security definer",
            "c.buyer_id = auth.uid() or c.seller_id = auth.uid()",
            "c.buyer_id = v_user or c.seller_id = v_user",
            "revoke all on function public.market_mark_read",
            "grant execute on function public.market_mark_read",
            "alter publication supabase_realtime add table public.market_conversations"
        ]:
            self.assertIn(phrase,sql,phrase)
        self.assertNotIn("grant all on public.market_conversation_reads to anon",sql.lower())

    def test_new_chat_script_syntax(self):
        script=ROOT/"assets/marketplace-v15.js"
        result=subprocess.run(["node","--check",str(script)],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)

if __name__=="__main__":
    unittest.main()
