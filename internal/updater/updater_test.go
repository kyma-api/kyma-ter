package updater

import "testing"

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		name    string
		a       string
		b       string
		want    int
		wantErr bool
	}{
		{name: "same", a: "0.1.0", b: "0.1.0", want: 0},
		{name: "upgrade", a: "0.1.1", b: "0.1.0", want: 1},
		{name: "downgrade", a: "0.1.0", b: "0.1.1", want: -1},
		{name: "strip v prefix", a: "v0.2.0", b: "0.1.9", want: 1},
		{name: "invalid latest", a: "latest", b: "0.1.0", wantErr: true},
		{name: "invalid current", a: "0.1.0", b: "dev", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := compareVersions(tt.a, tt.b)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got result %d", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("compareVersions(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}
