// Seeded random color for string - in the future there should be colors in client_format.json
// https://gist.github.com/0x263b/2bdd90886c2036a1ad5bcf06d6e6fb37
String.prototype.toHue = function() {
    var hash = 0;
    if (this.length === 0) return hash;
    for (var i = 0; i < this.length; i++) {
        hash = this.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    return hash % 360;
};
