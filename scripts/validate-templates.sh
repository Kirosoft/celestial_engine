#!/bin/bash
# Validate prompt template structure

set -e

echo "🔍 Validating prompt template structure..."
echo ""

# Check directories exist
echo "📁 Checking directory structure..."
for dir in prompts/library prompts/user prompts/shared; do
  if [ -d "$dir" ]; then
    echo "  ✓ $dir exists"
  else
    echo "  ✗ $dir missing"
    exit 1
  fi
done
echo ""

# Check .promptspec.yaml exists
echo "📄 Checking .promptspec.yaml..."
if [ -f "prompts/.promptspec.yaml" ]; then
  echo "  ✓ prompts/.promptspec.yaml exists"
else
  echo "  ✗ prompts/.promptspec.yaml missing"
  exit 1
fi
echo ""

# Count templates
echo "📝 Counting templates..."
TEMPLATE_COUNT=$(find prompts/library -name "*.md" -type f | wc -l)
echo "  Found $TEMPLATE_COUNT template(s)"
if [ "$TEMPLATE_COUNT" -ge 5 ]; then
  echo "  ✓ Minimum 5 templates present"
else
  echo "  ✗ Expected at least 5 templates (found $TEMPLATE_COUNT)"
  exit 1
fi
echo ""

# List templates
echo "📋 Template inventory:"
find prompts/library -name "*.md" -type f | sort | while read -r template; do
  basename_file=$(basename "$template" .md)
  category=$(basename "$(dirname "$template")")
  echo "  - $category/$basename_file"
done
echo ""

# Check README exists
echo "📖 Checking documentation..."
if [ -f "prompts/README.md" ]; then
  echo "  ✓ prompts/README.md exists"
else
  echo "  ✗ prompts/README.md missing"
  exit 1
fi
echo ""

echo "✅ Validation complete - all checks passed!"
