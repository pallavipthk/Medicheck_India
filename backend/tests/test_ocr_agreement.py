import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.ocr_scanner import extract_entities_from_text, match_brand_and_ingredients

class TestOCRAgreement(unittest.TestCase):

    def test_sibelium_flunarizine_dual_agreement(self):
        """Test that Sibelium + Flunarizine is detected and auto-selected because both agree."""
        sample_text = """
        Sibelium 10 mg
        Each film coated tablet contains:
        Flunarizine Dihydrochloride IP
        Equivalent to Flunarizine 10 mg
        Mfg: Janssen Pharmaceuticals
        Batch No: B98765
        """
        res = extract_entities_from_text(sample_text)
        self.assertEqual(res["detected_brand"], "Sibelium")
        self.assertIn("Flunarizine", res["detected_ingredients"])
        self.assertTrue(res["is_clear_read"])
        self.assertEqual(res["confidence_level"], "high")
        self.assertIsNotNone(res["best_candidate"])
        self.assertTrue(res["best_candidate"]["both_agree"])
        self.assertIn("Sibelium", res["best_candidate"]["medicine_name"])

    def test_composition_mismatch_rejection(self):
        """Test that if the photo read ingredient isn't in candidate composition, mismatch is flagged and auto-fill blocked."""
        # User has brand Sibelium but ingredient Paracetamol
        match_res = match_brand_and_ingredients(brand="Sibelium", ingredients=["Paracetamol"])
        sibelium_candidates = [c for c in match_res["candidates"] if "sibelium" in c["medicine_name"].lower()]
        self.assertTrue(len(sibelium_candidates) > 0)
        top_sibelium = sibelium_candidates[0]
        self.assertTrue(top_sibelium["brand_match"])
        self.assertFalse(top_sibelium["ingredient_match"])
        self.assertTrue(top_sibelium["is_mismatch"])
        self.assertFalse(top_sibelium["both_agree"])
        self.assertIsNone(match_res["best_candidate"])

    def test_weak_read_confidence_check(self):
        """Test that blurry/gibberish text triggers confidence failure without guessing."""
        weak_text = "??? blurry 123 !@#"
        res = extract_entities_from_text(weak_text)
        self.assertFalse(res["is_clear_read"])
        self.assertEqual(res["confidence_level"], "weak")
        self.assertIn("couldn't read this clearly", res["clarity_message"].lower())
        self.assertIsNone(res["best_candidate"])

if __name__ == "__main__":
    unittest.main()
